import readXlsxFile from 'read-excel-file/web-worker'
import { Binary, ColumnRef, ExpressionValue, ExprList, Parser, Select, Value } from 'node-sql-parser'
import { MatchingResults, SolTokenHistory } from './types/History'
import { extractDate, extractTime } from './lib'

type WhereEvalResult = { passed: boolean; failed: string[] }

const parser = new Parser()

self.onmessage = async ({ data }: MessageEvent) => {
  if (!data?.type) return

  if (data.type === 'XLSX') {
    for (const xlsx of data.allXlsx) {
      const rows = await readXlsxFile(xlsx)
      postMessage({ type: 'XLSX', rows, fileName: xlsx.name })
    }
    return
  }

  if (data.type === 'EVALUATE_QUERY') {
    const { query, history } = data as { history: SolTokenHistory, query: string }
    const results = evaluateQuery(query, history)
    self.postMessage({ type: 'QUERY_EVALUATION', results })
  }
}

function evaluateQuery(query: string, history: SolTokenHistory): MatchingResults {
  const fullQuery = `SELECT * FROM tokens WHERE ${query}`
  let ast: Select
  try {
    ast = parser.astify(fullQuery, { database: 'PostgresQL', trimQuery: true, parseOptions: { includeLocations: true } }) as Select
  } catch (error) {
    self.postMessage({ type: 'ERROR', message: error.message })
    return []
  }

  if (!ast.where) return []

  const normalizedWhere = normalizeWhereAst(ast.where)

  const results: MatchingResults = []
  if (!history.snapshots) return results

  let line = 1 // first line on XLSX is header
  for (const snapshot of history.snapshots) {
    line += 1
    const { failed: failedConditions } = evaluateWhereClause(normalizedWhere, snapshot, query)

    const currentValues: Map<string, string> = new Map()
    const orderedFields = Array.from(new Set(
      failedConditions.flatMap(cond =>
        Object.keys(snapshot).filter(field => new RegExp(`\\b${field}\\b`).test(cond) || cond.includes('kol(') && field === 'kol_wallets')
      )
    ))
    for (const field of orderedFields) {
      if (!currentValues.has(field)) currentValues.set(field, String(snapshot[field]))
    }

    const timestamp = snapshot.snapshot_at as string
    results.unshift({
      line,
      timestamp,
      time: extractTime(timestamp),
      date: extractDate(timestamp),
      mc: Number(snapshot.mc),
      failedConditions,
      currentValues
    })
  }

  return results
}

function evaluateWhereClause(node: Binary | ExpressionValue | ExprList, record: Record<string, any>, originalQuery: string): WhereEvalResult {
  if (node.type === 'function' || node.type === 'aggr_func') {
    const value = evaluateExpression(node, record)
    const passed = value === true
    return { passed, failed: passed ? [] : [extractValueText(node)] }
  }

  if (node.type === 'binary_expr') {
    const { operator, left, right } = node as Binary
    const opUpper = String(operator).toUpperCase()

    if (opUpper === 'AND') {
      const leftRes = evaluateWhereClause(left, record, originalQuery)
      const rightRes = evaluateWhereClause(right, record, originalQuery)
      return { passed: leftRes.passed && rightRes.passed, failed: [...leftRes.failed, ...rightRes.failed] }
    }

    if (opUpper === 'OR') {
      const leftRes = evaluateWhereClause(left, record, originalQuery)
      if (leftRes.passed) return { passed: true, failed: [] }

      const rightRes = evaluateWhereClause(right, record, originalQuery)
      if (rightRes.passed) return { passed: true, failed: [] }

      const orCondition = extractConditionText(node as Binary, originalQuery)
      return { passed: false, failed: [orCondition] }
    }

    const passed = evaluateBinaryCondition(node as Binary, record)
    return { passed, failed: passed ? [] : [extractConditionText(node as Binary, originalQuery)] }
  }

  return { passed: true, failed: [] }
}

function evaluateBinaryCondition(node: Binary, record: Record<string, any>): boolean {
  const { operator, left, right } = node

  const leftValue = normalizeNullish(evaluateExpression(left as any, record))
  const rightValue = evaluateExpression(right as any, record)
  const opUpper = operator.toUpperCase()

  // if ((node.left as any)?.column?.expr?.value === 'rugcheck_risks')
  // console.debug({ node, leftValue, operator, rightValue })

  // nullish values
  if (leftValue === undefined || leftValue === null) {
    if (opUpper === 'IS' && (rightValue === true || rightValue === 'TRUE' || rightValue === false || rightValue === 'FALSE')) return false
    if (opUpper === 'IS NOT' && (rightValue === true || rightValue === 'TRUE' || rightValue === false || rightValue === 'FALSE')) return true
    if (opUpper === 'IS' && rightValue === null) return true
    if (opUpper === 'IS NOT' && rightValue === null) return false

    return opUpper.includes('NULL')
  }

  if (opUpper === 'BETWEEN' || opUpper === 'NOT BETWEEN') {
    if (right.type === 'expr_list' && right.value.length === 2) {
      const min = evaluateExpression(right.value[0], record)
      const max = evaluateExpression(right.value[1], record)
      const numValue = Number(leftValue)
      const isBetween = numValue >= Number(min) && numValue <= Number(max)
      return opUpper === 'BETWEEN' ? isBetween : !isBetween
    }
    return false
  }

  if (opUpper === 'IN' || opUpper === 'NOT IN') {
    if (right.type === 'expr_list') {
      const values = right.value.map((v: any) => evaluateExpression(v, record))
      const isIn = values.includes(leftValue)
      return opUpper === 'IN' ? isIn : !isIn
    }
    return false
  }

  switch (opUpper) {
    case '>': return Number(leftValue) > Number(rightValue)
    case '<': return Number(leftValue) < Number(rightValue)
    case '>=': return Number(leftValue) >= Number(rightValue)
    case '<=': return Number(leftValue) <= Number(rightValue)
    case '=': return leftValue == rightValue
    case '!=':
    case '<>': return leftValue != rightValue
    case 'LIKE': return String(leftValue).includes(String(rightValue).replace(/%/g, ''))
    case 'NOT LIKE': return !String(leftValue).includes(String(rightValue).replace(/%/g, ''))
    case '~': return buildJsRegex(String(rightValue)).test(String(leftValue))
    case '!~': return !buildJsRegex(String(rightValue)).test(String(leftValue))
    case 'IS': {
      if (rightValue === true || rightValue === 'TRUE') return normalizeBooleanValue(leftValue) === true
      if (rightValue === false || rightValue === 'FALSE') return normalizeBooleanValue(leftValue) === false
      if (rightValue === null) return leftValue === null
      return false
    }
    case 'IS NOT': {
      if (rightValue === true || rightValue === 'TRUE') return leftValue === null || normalizeBooleanValue(leftValue) !== true
      if (rightValue === false || rightValue === 'FALSE') return leftValue === null || normalizeBooleanValue(leftValue) !== false
      if (rightValue === null) return leftValue !== null
      return false
    }
    default: return false
  }
}

function evaluateExpression(node: any, record: Record<string, any>): any {
  if (!node) return undefined

  if (node.type === 'column_ref') {
    const key = getNodeValue(node)
    return record[key]
  }

  if (node.type === 'number' || node.type === 'string' || node.type === 'bool') {
    return node.value
  }

  if (node.type === 'null') return null

  if (node.type === 'binary_expr') {
    const op = String(node.operator).toUpperCase()
    const leftVal = evaluateExpression(node.left, record)
    const rightVal = evaluateExpression(node.right, record)

    if (['+', '-', '*', '/'].includes(op)) {
      const l = Number(leftVal)
      const r = Number(rightVal)
      if (Number.isNaN(l) || Number.isNaN(r)) return undefined
      switch (op) {
        case '+': return l + r
        case '-': return l - r
        case '*': return l * r
        case '/': return r === 0 ? undefined : l / r
      }
    }

    return undefined
  }

  if (node.type === 'expr_list') {
    return node.value.map((v: any) => evaluateExpression(v, record))
  }

  if (node.type === 'function' || node.type === 'aggr_func') {
    const fn = String(getFunctionName(node)).toUpperCase()
    const args = getFunctionArgs(node).map((arg: any) => evaluateExpression(arg, record))
    // length(name) function
    if (fn === 'LENGTH') return String(args[0] ?? '').length
    // kol(50, 22) function
    if (fn === 'KOL') {
      const ids = args.map((v: any) => Number(v)).filter((v: number) => !Number.isNaN(v))
      if (ids.length === 0) return false

      const raw = record.kol_wallets
      let values: any = raw
      if (typeof raw === 'string') {
        try {
          values = JSON.parse(raw)
        } catch {
          return false
        }
      }

      if (!Array.isArray(values)) return false

      return ids.some((id: number) =>
        values.some((entry: any) =>
          (entry && typeof entry === 'object' && 'id' in entry && Number(entry.id) === id) || Number(entry) === id
        )
      )
    }
    return undefined
  }

  // Handle casts like uri_content::text
  if (node.type === 'cast') {
    const val = evaluateExpression(node.expr, record)
    return String(val)
  }

  if ('value' in node) return node.value

  return undefined
}

function getNodeValue(v: ColumnRef | Value) {
  return 'value' in v ? v.value : 'column' in v ? typeof v.column === 'string' ? v.column : v.column.expr?.value : String(v)
}

function extractConditionText(node: Binary, originalQuery: string): string {
  if (node.type === 'binary_expr') {
    const { operator, left, right } = node
    const leftText = extractValueText(left)
    const rightText = extractValueText(right)
    return `${leftText} ${operator} ${rightText}`
  }

  return 'unknown condition'
}

function extractValueText(node: any): string {
  if (!node) return 'null'
  if (node.type === 'column_ref') return getNodeValue(node)
  if (node.type === 'binary_expr') return `(${extractConditionText(node as Binary, '')})`
  if (node.type === 'function' || node.type === 'aggr_func') return extractFunctionText(node)
  if (node.type === 'cast') return extractCastText(node)
  if (node.type === 'string') return `'${node.value}'`
  if (node.type === 'number' || node.type === 'bool') return String(node.value)
  if (node.type === 'null') return 'NULL'
  if (node.type === 'expr_list') {
    return `(${node.value.map((v: any) => extractValueText(v)).join(', ')})`
  }
  if (node.type === "single_quote_string" || node.type === "double_quote_string") return `'${String(node.value)}'`
  return 'value' in node ? String(node.value) : String(node)
}

function extractCastText(node: any): string {
  const exprText = extractValueText(node.expr)
  const typeText = node.target?.dataType || node.target?.name || node.target?.value || 'text'
  return `${exprText}::${typeText}`
}

function extractFunctionText(node: any): string {
  if (node.type === 'function' || node.type === 'aggr_func') {
    const args = getFunctionArgs(node).map((arg: any) => {
      if (arg.type === 'column_ref') return getNodeValue(arg)
      if (arg.type === 'string') return `'${arg.value}'`
      if (arg.type === 'number' || arg.type === 'bool') return String(arg.value)
      return String(arg.value ?? arg)
    }).join(', ') || ''
    return `${getFunctionName(node)}(${args})`
  }
  return ''
}

function buildJsRegex(pgPattern: string): RegExp {
  const inlineFlagMatch = pgPattern.match(/^\(\?([imsu]+)\)/)
  const flags = inlineFlagMatch ? inlineFlagMatch[1] : ''
  const pattern = inlineFlagMatch ? pgPattern.replace(/^\(\?[imsu]+\)/, '') : pgPattern
  return new RegExp(pattern, flags)
}

function normalizeBooleanValue(value: any): boolean | undefined {
  if (value === true || value === false) return value
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (v === 'true') return true
    if (v === 'false') return false
  }
  return undefined
}

function normalizeNullish(value: any): any {
  return value === undefined ? null : value
}

function getFunctionName(node: any): string {
  if (typeof node.name === 'string') return node.name
  if (Array.isArray(node.name?.name)) {
    const token = node.name.name[0]
    if (token?.value) return String(token.value)
  }
  if (node.name?.name) return node.name.name
  return String(node.name || '')
}

function getFunctionArgs(node: any): any[] {
  const args = node.args
  if (!args) return []
  if (Array.isArray(args)) return args
  if (Array.isArray(args.value)) return args.value
  if (args.expr) return [args.expr]
  if (Array.isArray(args.expr?.value)) return args.expr.value
  return []
}

// Make sure AND and OR are ordered properly
function normalizeWhereAst(node: Binary | ExpressionValue | ExprList): Binary | ExpressionValue | ExprList {
  if (!node || node.type !== 'binary_expr') return node

  const left = normalizeWhereAst((node as Binary).left) as any
  const right = normalizeWhereAst((node as Binary).right) as any
  const opUpper = String((node as Binary).operator).toUpperCase()

  const current = { ...(node as any), left, right }

  if (opUpper === 'AND') {
    const leftOpUpper = left?.type === 'binary_expr' ? String(left.operator).toUpperCase() : ''
    if (leftOpUpper === 'OR') {
      const a = left.left
      const b = left.right
      const c = right
      const rotatedRight = normalizeWhereAst({ ...current, operator: 'AND', left: b, right: c } as any)
      return { ...left, operator: 'OR', left: a, right: rotatedRight } as any
    }
  }

  return current as any
}
