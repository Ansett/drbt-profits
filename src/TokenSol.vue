<template>
  <main>
    <div
      class="flex flex-column xl:flex-row gap-3 xl:gap-1 align-items-center xl:align-items-stretch justify-content-center"
    >
      <div class="w-screen lg:w-11 m-1" style="max-width: min(95vw, 100rem)">
        <FileUpload
          ref="uploader"
          mode="advanced"
          accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          multiple
          :showUploadButton="false"
          :showCancelButton="false"
          chooseLabel="&hairsp;"
          :pt="{
            content: { class: 'p-3 xl:p-5' },
            chooseicon: { class: 'm-0' },
            buttonbar: { class: 'p-0' },
            choosebutton: { class: 'absolute mt-2 ml-2 z-1' },
          }"
          @select="onUpload($event)"
        >
          <template #empty>
            <ProgressSpinner
              v-if="uploading"
              class="absolute top-50 left-50"
              style="width: 99px; height: 99px; transform: translate(-50%, -88%); z-index: 99"
              :pt="{
                spinner: { style: { animationDuration: '0s' } },
              }"
            />

            <div class="flex flex-column m-1 align-items-center justify-content-center">
              <i
                class="pi pi-file mb-4"
                :style="{
                  fontSize: '4rem',
                  color: selectedFile ? 'var(--primary-color)' : 'var(--cyan-300)',
                }"
              />

              <template v-if="selectedFile">
                <Dropdown
                  v-model="current"
                  optionLabel="fileName"
                  :options="archives"
                  v-bind="{ 'aria-label': 'Current calls file' }"
                  style="max-width: 21rem"
                  scrollHeight="300px"
                >
                  <template #option="{ option, index }">
                    <div class="flex align-items-center gap-3">
                      <div class="flex-auto">{{ option.fileName }}</div>
                      <Button
                        icon="pi pi-trash"
                        severity="secondary"
                        text
                        rounded
                        size="small"
                        aria-label="Delete"
                        @click.stop="removeArchive(index)"
                      />
                    </div>
                  </template>
                </Dropdown>

                <div
                  class="flex flex-row align-items-center gap-2 flex-wrap align-items-baseline justify-content-center"
                >
                  <CaLink
                    v-if="current"
                    :name="current.name"
                    :ca="current.mint"
                    :screener-url="state.screenerUrl"
                    class="mt-2"
                  />
                  <span class="flex flex-wrap column-gap-2 text-sm">
                    (
                    <span class="nowrap">{{ current?.created[0] }}</span>
                    <span class="nowrap text-color-secondary">{{
                      current?.created[1] + ' UTC'
                    }}</span>
                    )
                  </span>
                </div>
              </template>
              <template v-else>
                <p class="text-center">Drag and drop a DRBT <strong>token history</strong></p>
                <p class="text-center text-sm font-italic text-color-secondary">
                  Nothing is uploaded, computation is done by your browser
                </p>
              </template>
            </div>
          </template>

          <template #content>
            <div />
          </template>
        </FileUpload>

        <ProgressSpinner
          v-if="loading"
          class="absolute top-50 left-50 spinner z-1"
          v-bind="{ 'data-info': typeof loading === 'string' ? loading : '' }"
        />

        <Accordion :activeIndex="[0, 1]" multiple class="mt-4 h-full">
          <!-- QUERY -->
          <AccordionTab
            header="QUERY"
            :pt="{ root: { class: 'mb-4 relative ' + (isSticky ? 'sticky' : '') } }"
          >
            <!-- pin button -->
            <Button
              size="small"
              text
              severity="secondary"
              tabindex="-1"
              class="cardButton"
              aria-label="Pin"
              v-tooltip.left="{
                value: isSticky ? 'Unpin' : 'Pin',
                showDelay: 500,
              }"
              @click.stop="isSticky = !isSticky"
            >
              <template #icon>
                <span class="material-symbols-outlined cursor-pointer">{{
                  isSticky ? 'keep_off' : 'keep'
                }}</span>
              </template>
            </Button>

            <!-- EDITOR and error message -->
            <div class="flex flex-column gap-2">
              <div ref="editorEl" class="cm-host" />
              <Message v-if="error" severity="error" :icon="'none'">{{ error }}</Message>
            </div>
          </AccordionTab>

          <AccordionTab header="SNAPSHOTS" :pt="{ root: { class: 'mb-5 relative ' } }">
            <!-- light mode button -->
            <Button
              size="small"
              text
              severity="secondary"
              tabindex="-1"
              class="cardButton"
              aria-label="Filter"
              v-tooltip.left="{
                value: lightMode ? 'Show all' : 'Show only when conditions change',
                showDelay: 500,
              }"
              @click.stop="lightMode = !lightMode"
            >
              <template #icon>
                <span class="material-symbols-outlined cursor-pointer">{{
                  lightMode ? 'filter_list_off' : 'filter_list'
                }}</span>
              </template></Button
            >

            <!-- RESULTS -->
            <div class="flex flex-column relative gap-4">
              <i
                v-if="!failedConditionsToShow.length"
                class="pi pi-list my-2 mx-auto"
                :style="{
                  fontSize: '4rem',
                  color: 'var(--surface-100)',
                }"
              />
              <template v-else>
                <div v-for="result of failedConditionsToShow" :key="result.timestamp">
                  <div
                    class="flex flex-row flex-wrap row-gap-2 column-gap-3 align-items-center mb-2"
                  >
                    <!-- LINE -->
                    <span class="text-sm text-color-secondary">#{{ result.line }}</span>
                    <!-- TIME -->
                    <span
                      class="font-semibold"
                      v-tooltip.top="{
                        value: result.date,
                        showDelay: 500,
                      }"
                      >{{ result.time.split('.')[0]
                      }}<span class="font-normal text-xs text-color-secondary"
                        >.{{ result.time.split('.')[1] }}</span
                      ></span
                    >
                    <!-- MC -->
                    <span class="font-semibold">{{ prettifyMc(result.mc) }}</span>
                    <!-- No-match count -->
                    <span
                      v-if="result.failedConditions.length"
                      :class="[
                        'text-xs line-height-1 font-italic',
                        minFailed && result.failedConditions.length <= minFailed
                          ? 'text-green-500'
                          : 'text-color-secondary',
                      ]"
                      >{{ result.failedConditions.length }} not matching&hairsp;:</span
                    >
                    <span v-else class="text-xs line-height-1 font-italic text-green-300"
                      >ALL matching</span
                    >
                    <!-- Query chunks -->
                    <span
                      v-for="chunk of result.failedConditions"
                      :key="chunk"
                      class="queryChunk text-sm text-white border-dotted border-200 border-round px-1"
                      @mouseenter="onChunkEnter(result.time, chunk)"
                      @mouseleave="onChunkLeave"
                      @click="onChunkEnter(result.time, chunk)"
                      v-html="highlightSql(chunk)"
                    ></span>
                  </div>

                  <div
                    v-if="result.failedConditions.length"
                    class="flex flex-row flex-wrap row-gap-1 column-gap-3 align-items-center mb-2"
                  >
                    <span class="text-xs text-color-secondary font-italic line-height-1 pr-1"
                      >Current values&hairsp;:</span
                    >
                    <!-- Values -->
                    <span
                      v-for="[field, value] of result.currentValues"
                      :key="field"
                      :class="[
                        'snapshotValue text-sm text-secondary',
                        { corresponding: isValueHighlighted(field, result.time) },
                      ]"
                      ><span>{{ field + '=' }}</span
                      >{{ value }}</span
                    >
                  </div>
                </div>
              </template>
            </div>
          </AccordionTab>
        </Accordion>

        <div class="flex flex-column md:flex-row gap-3 mt-3">
          <!-- Min MC -->
          <div class="flex flex-column gap-2">
            <label for="min-mc-input">Min MC</label>
            <InputGroup>
              <InputGroupAddon>
                <span class="material-symbols-outlined">south</span>
              </InputGroupAddon>
              <InputNumber
                v-model="state.minMc"
                v-bind="{ id: 'min-mc-input' }"
                showButtons
                buttonLayout="stacked"
                :min="0"
                :step="1000"
                :pt="getPtNumberInput()"
                class="settingInput"
              />
            </InputGroup>
          </div>
          <!-- Max MC -->
          <div class="flex flex-column gap-2">
            <label for="max-mc-input">Max MC</label>
            <InputGroup>
              <InputGroupAddon>
                <span class="material-symbols-outlined">north</span>
              </InputGroupAddon>
              <InputNumber
                v-model="state.maxMc"
                v-bind="{ id: 'max-mc-input' }"
                showButtons
                buttonLayout="stacked"
                :min="0"
                :step="10000"
                :pt="getPtNumberInput()"
                class="settingInput"
              />
            </InputGroup>
          </div>
          <!-- SCREENER URL -->
          <div class="flex flex-column gap-2 flex-1">
            <label for="screener-url-input">Screener URL</label>
            <InputGroup>
              <InputGroupAddon>
                <i class="pi pi-chart-line"></i>
              </InputGroupAddon>
              <InputText
                v-model.trim="state.screenerUrl"
                id="screener-url-input"
                class="settingInput"
              />
            </InputGroup>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, nextTick, ref, shallowRef, watch, onUnmounted, reactive } from 'vue'
import FileUpload, { type FileUploadSelectEvent } from 'primevue/fileupload'
import ProgressSpinner from 'primevue/progressspinner'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import Message from 'primevue/message'
import Accordion from 'primevue/accordion'
import AccordionTab from 'primevue/accordiontab'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import vTooltip from 'primevue/tooltip'
import { highlightTree, classHighlighter } from '@lezer/highlight'
import { MatchingResults, SolTokenHistory } from './types/History'
import { debounce, localStorageGetObject, localStorageSetObject, prettifyMc, sleep } from './lib'
import CaLink from './components/CaLink.vue'
import { DEFAULT_SOL_SCREENER_URL, getPtNumberInput } from './constants'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import { useTimezone } from './compose/useTimezone'

const { formatDate } = useTimezone()

const error = ref('')
const loading = ref<string | boolean>(false)
const uploading = ref(0)
const uploader = ref<InstanceType<typeof FileUpload>>()
const initialized = ref(false)
const isSticky = ref(false)
const query = ref(window.location.hostname === 'localhost' ? localStorage.getItem('query') : '')

const lightMode = ref(true)
const evaluationResults = ref<MatchingResults>([])

const INIT_MIN_MC = 0
const INIT_MAX_MC = 1000000
const INIT_SCREENER_URL = DEFAULT_SOL_SCREENER_URL
const state = reactive({
  minMc: INIT_MIN_MC,
  maxMc: INIT_MAX_MC,
  screenerUrl: INIT_SCREENER_URL,
})

const STATE_STORAGE_KEY = 'state-sol-token-a'
function storeForm() {
  localStorageSetObject(STATE_STORAGE_KEY, state)
}
watch(state, () => storeForm(), { deep: true })

function loadForm() {
  const savedState = localStorageGetObject(STATE_STORAGE_KEY)
  if (!savedState) return
  state.minMc = savedState.minMc ?? INIT_MIN_MC
  state.maxMc = savedState.maxMc ?? INIT_MAX_MC
  state.screenerUrl = savedState.screenerUrl ?? INIT_SCREENER_URL
}

const failedConditionsToShow = computed(() => {
  const minMc = Number(state.minMc) || 0
  const maxMc = Number(state.maxMc) || 0

  const mcFiltered = evaluationResults.value.filter(result => {
    const mc = Number(result.mc)
    if (Number.isNaN(mc)) return false
    if (minMc > 0 && mc < minMc) return false
    if (maxMc > 0 && mc > maxMc) return false
    return true
  })

  return lightMode.value
    ? mcFiltered.filter((result, index, arr) => {
        const prev = arr[index - 1]
        if (!prev) return true

        const prevKey = JSON.stringify(prev?.failedConditions ?? [])
        const key = JSON.stringify(result.failedConditions ?? [])
        return key !== prevKey
      })
    : mcFiltered
})

const minFailed = computed(() => {
  if (!failedConditionsToShow.value.length) return 0
  return Math.min(
    ...Array.from(failedConditionsToShow.value.values()).map(v => v.failedConditions.length),
  )
})

const worker = shallowRef<Worker | null>(null)

const hoveredChunk = ref<{ time: string; chunk: string } | null>(null)
const changeHoveredChunk = (value: { time: string; chunk: string }) => {
  hoveredChunk.value = value
}
const debouncedHoveredChunk = debounce(changeHoveredChunk, 10)
const onChunkEnter = (time: string, chunk: string) => {
  debouncedHoveredChunk({ time, chunk })
}
const onChunkLeave = () => {
  debouncedHoveredChunk(null)
}
const isValueHighlighted = (field: string, time: string): boolean => {
  if (!hoveredChunk.value || hoveredChunk.value.time !== time) return false
  return new RegExp(`\\b${escapeRegExp(field)}\\b`, 'i').test(hoveredChunk.value.chunk)
}

onMounted(async () => {
  loadForm()
  await nextTick(initEditor)
  await createWorker()
  initialized.value = true
})
const createWorker = async () => {
  const WorkerConstructor = (await import('@/worker-sol-token?worker')).default
  worker.value = new WorkerConstructor()
  worker.value!.onmessage = handleWorkerMessage
  worker.value!.onerror = ({ message }) => {
    error.value = message
  }
}
onUnmounted(() => {
  editorView.value?.destroy()
  editorView.value = null
})

async function handleWorkerMessage({ data }: any) {
  if (data.type === 'XLSX') {
    uploading.value = Math.max(0, uploading.value - 1)
    return storeData(data.rows, data.fileName)
  } else if (data.type === 'QUERY_EVALUATION') {
    evaluationResults.value = data.results
    loading.value = false
  } else if (data.type === 'ERROR') {
    error.value = data.message
    loading.value = false
  }
}

const archives = ref<SolTokenHistory[]>([])
const current = ref<SolTokenHistory | null>(null)
const removeArchive = (index: number) => {
  if (archives.value[index].fileName === current.value?.fileName) current.value = archives.value[0]
  archives.value.splice(index, 1)
}
const selectedFile = computed(() => current.value?.fileName || '')

async function storeData(rows: (string | number | Date)[][], fileName: string) {
  if (rows.length < 2) return
  const headers = rows.shift() as string[]
  const name = rows[0][headers.indexOf('name')] as string
  const mint = rows[0][headers.indexOf('mint')] as string
  const created = rows[0][headers.indexOf('created_at')] as Date

  const snapshots: SolTokenHistory['snapshots'] = []
  for (const row of rows) {
    const entry: Record<string, number | string> = {}
    for (const index in headers) {
      entry[headers[index]] = handleTableValue(row[index])
    }
    snapshots.push(entry)
  }

  const newArchive: SolTokenHistory = {
    snapshots,
    fileName,
    name,
    mint,
    created: formatDate(created),
  }
  current.value = newArchive
  const existIndex = archives.value.findIndex(a => a.fileName === newArchive.fileName)
  if (existIndex > -1) archives.value.splice(existIndex, 1, newArchive)
  else archives.value.push(newArchive)
}

function handleTableValue(value: number | string | Date): number | string {
  if (value instanceof Date) {
    return value.toISOString()
  }
  return value
}

const onUpload = async (event: FileUploadSelectEvent) => {
  const { files } = event
  if (!files?.length) return

  const allXlsx = [...files]
  ;(uploader.value as any)?.clear()

  uploading.value = allXlsx.length
  worker.value?.postMessage({ type: 'XLSX', allXlsx })
}

const runCompute = async () => {
  if (!current.value?.snapshots.length) return

  loading.value = true
  error.value = ''
  await nextTick()
  await sleep(500) // waiting for color transition on inputs

  return worker.value?.postMessage({
    type: 'EVALUATE_QUERY',
    history: JSON.parse(JSON.stringify(current.value)),
    query: query.value,
  })
}
const debouncedCompute = debounce(runCompute, 1000)
watch(current, () => {
  if (!initialized.value || !query.value || !current.value?.snapshots.length) return

  runCompute()
})
watch(query, val => {
  if (!initialized.value || !current.value?.snapshots.length) return

  if (val && window.location.hostname === 'localhost') localStorage.setItem('query', val)

  const view = editorView.value
  if (view) {
    const current = view.state.doc.toString()
    if (current !== val) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: val || '' } })
    }
  }

  debouncedCompute()
})

const editorEl = ref<HTMLDivElement | null>(null)
const editorView = shallowRef<any | null>(null)
let sqlParser: typeof import('@codemirror/lang-sql')['sql']
let PostgreParser: typeof import('@codemirror/lang-sql')['PostgreSQL']

async function initEditor() {
  if (!editorEl.value || editorView.value) return

  const [
    { EditorView, minimalSetup },
    { EditorState },
    { sql, PostgreSQL },
    { cobalt2 },
    { ViewPlugin, Decoration, MatchDecorator },
  ] = await Promise.all([
    import('codemirror'),
    import('@codemirror/state'),
    import('@codemirror/lang-sql'),
    import('@fsegurai/codemirror-theme-cobalt2'),
    import('@codemirror/view'),
  ])
  sqlParser = sql
  PostgreParser = PostgreSQL

  const opDecorator = new MatchDecorator({
    regexp: /\b(?:AND|OR)\b/g,
    decoration: Decoration.mark({ class: 'cm-syntax-logic' }),
  })
  const opPlugin = ViewPlugin.fromClass(
    class {
      decorations
      constructor(readonly view: any) {
        this.decorations = opDecorator.createDeco(view)
      }
      update(update: any) {
        this.decorations = opDecorator.updateDeco(update, this.decorations)
      }
    },
    { decorations: v => v.decorations },
  )
  const nameDecorator = new MatchDecorator({
    regexp: /\bname\b/g,
    decoration: Decoration.mark({ class: 'cm-syntax-name' }),
  })
  const namePlugin = ViewPlugin.fromClass(
    class {
      decorations
      constructor(readonly view: any) {
        this.decorations = nameDecorator.createDeco(view)
      }
      update(update: any) {
        this.decorations = nameDecorator.updateDeco(update, this.decorations)
      }
    },
    { decorations: v => v.decorations },
  )

  const state = EditorState.create({
    doc: query.value || '',
    extensions: [
      minimalSetup,
      cobalt2,
      sql({ dialect: PostgreSQL }),
      EditorView.lineWrapping,
      opPlugin,
      namePlugin,
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          const text = update.state.doc.toString()
          if (query.value !== text) query.value = text
        }
      }),
    ],
  })
  editorView.value = new EditorView({ state, parent: editorEl.value })
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightSql(code: string): string {
  const lang = sqlParser({ dialect: PostgreParser })
  const tree = lang.language.parser.parse(code)
  let html = ''
  let pos = 0

  highlightTree(tree, classHighlighter, (from, to, classes) => {
    if (from > pos) html += escapeHtml(code.slice(pos, from))
    const token = code.slice(from, to)
    const upper = token.toUpperCase()
    const extraClass =
      upper === 'AND' || upper === 'OR'
        ? ' tok-syntax-logic'
        : upper === 'NAME'
        ? 'tok-syntax-name'
        : ''
    html += `<span class="${classes}${extraClass}">${escapeHtml(token)}</span>`
    pos = to
  })

  if (pos < code.length) html += escapeHtml(code.slice(pos))
  return html
}
</script>

<style scoped>
.cardButton {
  position: absolute;
  right: 0.5rem;
  top: 0.5rem;
  z-index: 2;
}
.cardButton:focus,
.cardButton:active {
  box-shadow: none !important;
  border-color: transparent !important;
}

.queryChunk {
  font-family: 'Courier New', Courier, monospace;
  display: inline-block;
  white-space: pre-wrap;
  background-color: rgba(129, 140, 248, 0.1); /* var(--highlight-bg) */
}

.queryChunk :deep(.tok-keyword) {
  color: #ff9d00;
}
.queryChunk :deep(.tok-string) {
  color: #a5ff90;
}
.queryChunk :deep(.tok-number) {
  color: #ff628c;
}
.queryChunk :deep(.tok-bool) {
  color: #ff628c;
}
/* AND/OR operators */
.queryChunk :deep(.tok-syntax-logic),
.cm-host :deep(.cm-syntax-logic) > * {
  color: #ffee80;
}
/* 'name' variable  */
.queryChunk :deep(.tok-syntax-name),
.cm-host :deep(.cm-syntax-name) > * {
  color: inherit;
}

.cm-host {
  border: 1px solid var(--surface-200);
  border-radius: 6px;
  min-height: 8rem;
  font-family: 'Courier New', Courier, monospace;
  padding: 5px;
}
.cm-host :deep(.cm-editor) {
  outline: none;
  max-height: 25vh;
}
.cm-host :deep(.cm-scroller) {
  font-family: 'Courier New', Courier, monospace;
}
.cm-host :deep(.cm-cursor) {
  border-left-color: white;
}
.cm-host :deep(.cm-editor) {
  background-color: transparent;
}

.snapshotValue {
  max-width: 40rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &.corresponding,
  &.corresponding > span {
    color: var(--primary-color);
  }

  & > span {
    color: var(--text-color-secondary);
  }
}
</style>
