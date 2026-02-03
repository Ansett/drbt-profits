<template>
  <main>
    <div
      class="flex flex-column xl:flex-row gap-3 xl:gap-1 align-items-center xl:align-items-stretch justify-content-center"
    >
      <div class="w-screen lg:w-11 m-1 xl:m-4" style="max-width: min(95vw, 100rem)">
        <FileUpload
          ref="uploader"
          mode="advanced"
          accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          multiple
          :showUploadButton="false"
          :showCancelButton="false"
          chooseLabel="&nbsp;Import"
          :pt="{
            content: 'p-3 xl:p-5',
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

                <CaLink
                  v-if="current"
                  :name="current.name"
                  :ca="current.mint"
                  :screener-url="screenerUrl"
                  class="mt-2"
                />
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

        <Accordion :activeIndex="[0, 1]" multiple lazy class="mt-4 h-full">
          <!-- QUERY -->
          <AccordionTab
            header="QUERY"
            :pt="{
              root: { class: 'mb-4' },
            }"
          >
            <div class="flex flex-column gap-2">
              <div ref="editorEl" class="cm-host" />
              <Message v-if="error" severity="error" :icon="'none'">{{ error }}</Message>
            </div>
          </AccordionTab>
          <!-- RESULTS -->
          <AccordionTab header="RESULTS">
            <div class="flex flex-column relative gap-4">
              <i
                v-if="!evaluationResults.size"
                class="pi pi-list my-2 mx-auto"
                :style="{
                  fontSize: '4rem',
                  color: 'var(--surface-100)',
                }"
              />
              <template v-else>
                <div
                  v-for="[time, result] of evaluationResults"
                  :key="time"
                  class="flex flex-row flex-wrap row-gap-1 column-gap-2 align-items-center mb-2"
                >
                  <!-- TIME -->
                  <span
                    class="font-semibold pr-1"
                    v-tooltip.top="{
                      value: result.date,
                      showDelay: 500,
                    }"
                    >{{ time.split('.')[0]
                    }}<span class="font-normal text-color-secondary"
                      >.{{ time.split('.')[1] }}</span
                    ></span
                  >
                  <!-- MC -->
                  <span class="font-semibold pr-1">{{ prettifyMc(result.mc) }}</span>
                  <!-- No-match count -->
                  <span
                    :class="[
                      'text-xs line-height-1 pr-1',
                      minFailed && result.failedConditions.length <= minFailed
                        ? 'text-primary'
                        : 'text-color-secondary',
                    ]"
                    >{{ result.failedConditions.length }} not matching&hairsp;:</span
                  >
                  <!-- Query chunks -->
                  <span
                    v-for="q of result.failedConditions"
                    :key="q"
                    class="text-sm text-white queryChunk border-dotted border-200 border-round px-2"
                    v-html="highlightSql(q)"
                  ></span>
                </div>
              </template>
            </div>
          </AccordionTab>
        </Accordion>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, nextTick, ref, shallowRef, watch, onUnmounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import FileUpload, { type FileUploadSelectEvent } from 'primevue/fileupload'
import ProgressSpinner from 'primevue/progressspinner'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import Message from 'primevue/message'
import Accordion from 'primevue/accordion'
import AccordionTab from 'primevue/accordiontab'
import vTooltip from 'primevue/tooltip'
import { highlightTree, classHighlighter } from '@lezer/highlight'
import { MatchingResults, SolTokenHistory } from './types/History'
import { debounce, localStorageGetObject, prettifyMc, sleep } from './lib'
import CaLink from './components/CaLink.vue'
import { DEFAULT_SOL_SCREENER_URL, STATE_STORAGE_KEY } from './constants'

const toast = useToast()

const error = ref('')
const loading = ref<string | boolean>(false)
const uploading = ref(0)
const uploader = ref<InstanceType<typeof FileUpload>>()
const initialized = ref(false)
const query = ref(window.location.hostname === 'localhost' ? localStorage.getItem('query') : '')
const evaluationResults = ref<MatchingResults>(new Map())
const minFailed = computed(() => {
  if (!evaluationResults.value.size) return 0
  return Math.min(
    ...Array.from(evaluationResults.value.values()).map(v => v.failedConditions.length),
  )
})

const worker = shallowRef<Worker | null>(null)
const screenerUrl =
  localStorageGetObject(STATE_STORAGE_KEY)?.screenerUrl ?? DEFAULT_SOL_SCREENER_URL

onMounted(async () => {
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
    console.log(data.results)
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

  const snapshots: SolTokenHistory['snapshots'] = []
  for (const row of rows) {
    const entry: Record<string, number | string> = {}
    for (const index in headers) {
      entry[headers[index]] = handleTableValue(row[index])
    }
    snapshots.push(entry)
  }

  snapshots.reverse()
  const newArchive: SolTokenHistory = { snapshots, fileName, name, mint }
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

  const [{ EditorView, minimalSetup }, { EditorState }, { sql, PostgreSQL }, { cobalt2 }] =
    await Promise.all([
      import('codemirror'),
      import('@codemirror/state'),
      import('@codemirror/lang-sql'),
      import('@fsegurai/codemirror-theme-cobalt2'),
    ])
  sqlParser = sql
  PostgreParser = PostgreSQL

  const state = EditorState.create({
    doc: query.value || '',
    extensions: [
      minimalSetup,
      cobalt2,
      sql({ dialect: PostgreSQL }),
      EditorView.lineWrapping,
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

function highlightSql(code: string): string {
  const lang = sqlParser({ dialect: PostgreParser })
  const tree = lang.language.parser.parse(code)
  let html = ''
  let pos = 0

  highlightTree(tree, classHighlighter, (from, to, classes) => {
    if (from > pos) html += escapeHtml(code.slice(pos, from))
    html += `<span class="${classes}">${escapeHtml(code.slice(from, to))}</span>`
    pos = to
  })

  if (pos < code.length) html += escapeHtml(code.slice(pos))
  return html
}
</script>

<style scoped>
.queryChunk {
  font-family: 'Courier New', Courier, monospace;
  display: inline-block;
  white-space: pre-wrap;
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
.queryChunk :deep(.tok-variableName) {
  color: #ffc600;
}

.cm-host {
  border: 1px solid var(--surface-200);
  border-radius: 6px;
  min-height: 12rem;
  font-family: 'Courier New', Courier, monospace;
  padding: 5px;
}
.cm-host :deep(.cm-editor) {
  outline: none;
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
</style>
