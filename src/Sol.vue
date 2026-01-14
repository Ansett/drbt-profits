<template>
  <main>
    <div
      class="flex flex-column xl:flex-row gap-3 xl:gap-1 align-items-center xl:align-items-start justify-content-center"
    >
      <div class="w-screen xl:w-6 m-1 xl:m-4" style="max-width: min(95vw, 75rem)">
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
              style="width: 99px; height: 99px; transform: translate(-50%, -88%); zindex: 99"
              :pt="{
                spinner: { style: { animationDuration: '0s' } },
              }"
            />

            <div class="flex flex-column m-1 align-items-center justify-content-center">
              <i
                class="pi pi-file mb-4"
                :style="{
                  fontSize: '5.25rem',
                  color: selectedFile ? 'var(--primary-color)' : 'var(--cyan-300)',
                }"
              />

              <template v-if="selectedFile">
                <InputGroup class="w-auto">
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
                  <!-- Archives comparator -->
                  <Button
                    v-if="archives.length"
                    icon="pi pi-code"
                    outlined
                    :disabled="archives.length < 2"
                    v-tooltip.bottom="{
                      value:
                        archives.length < 2
                          ? 'You can upload other XLSX to compare calls'
                          : 'Examine differences between 2 files',
                      showDelay: 500,
                    }"
                    aria-label="Difference"
                    style="pointer-events: auto"
                    @click="showDiff = true"
                  >
                    <template #icon>
                      <span class="material-symbols-outlined cursor-pointer">difference</span>
                    </template>
                  </Button>
                  <!-- Wallets special button -->
                  <Button
                    v-if="canSeeWallets"
                    icon="pi pi-wallet"
                    aria-label="Wallets analysis"
                    outlined
                    severity="primary"
                    class="mx-1"
                    @click="showWalletsView()"
                  />
                </InputGroup>
              </template>
              <template v-else>
                <p class="text-center">Drag and drop a DRBT backtest export</p>
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

        <Message v-if="error" severity="error" :icon="'none'" class="m-6">{{ error }}</Message>

        <Accordion :activeIndex="[0]" multiple lazy class="mt-5">
          <!-- RESULTS -->
          <AccordionTab header="STATISTICS">
            <Statistics
              :loading="loading"
              info
              :final="finalWorth"
              currency="SOL"
              :drawdown="drawdown"
              :volume="volume"
              :worstDrawdown="worstDrawdown"
              :counters="counters"
              :nbCalls="filteredCalls.length"
              :full-stats="state.showFullStats"
              :buyInfo="buyInfo"
              @fullStats="state.showFullStats = $event"
            />
          </AccordionTab>

          <!-- LOGS -->
          <AccordionTab
            header="LOGS"
            :pt="{
              root: { class: 'relative' },
              content: { class: 'p-0' },
            }"
            ><LogsTable
              :logs="logs"
              v-model:textual="state.textLogs"
              v-model:selectedColumns="state.logsColumns"
              withDisplaySwitch
              withActions
              :screener-url="state.screenerUrl"
              chain="SOL"
              @ignore="ignoreCa"
              @exportXlsx="exportXlsx"
            >
            </LogsTable>
          </AccordionTab>

          <!-- TARGETS -->
          <AccordionTab header="TARGET SIMULATOR" :pt="{ content: { class: 'p-0' } }">
            <TargetFinder
              chain="SOL"
              :data="{
                calls: filteredCalls,
                position: state.position,
              }"
              :mcRange="[100000, 100000, 5000000]"
              :amountRange="[10, 10, 200]"
            />
          </AccordionTab>

          <!-- TIMING -->
          <AccordionTab header="DAILY BREAKDOWN" :pt="{ content: { class: 'p-0' } }">
            <TimingFinder :logs="logs" />
          </AccordionTab>

          <!-- PROGRAMS -->
          <AccordionTab header="PROGRAM IDS" :pt="{ content: { class: 'p-0' } }">
            <HashTable
              :lines="programsWithTags"
              filter-template="program_ids::text !~ '({})'"
              v-model:selectedColumns="state.hashColumns"
              :screener-url="state.screenerUrl"
              @removeTag="removeTag"
              @addTag="addTag"
            />
          </AccordionTab>
        </Accordion>
      </div>

      <div
        class="flex flex-column mx-1 xl:mx-4 my-2 gap-3 lg:gap-4"
        style="max-width: min(95vw, 60rem)"
      >
        <div class="flex flex-row flex-wrap gap-3 lg:gap-4 mb-3">
          <!-- POSITION -->
          <div class="flex flex-column gap-2 flex-1">
            <label for="position-input">Max bag</label>
            <InputGroup>
              <InputGroupAddon>
                <i class="pi pi-wallet"></i>
              </InputGroupAddon>
              <InputNumber
                v-model="state.position"
                v-bind="{ id: 'position-input' }"
                showButtons
                buttonLayout="stacked"
                suffix=" ◎"
                :min="0.1"
                mode="decimal"
                :step="0.1"
                :pt="getPtNumberInput()"
                class="settingInput"
                style="height: 4rem"
              />
            </InputGroup>
          </div>
        </div>

        <!-- TP -->
        <Targets
          v-model:takeProfits="state.takeProfits"
          v-model:autoRedistributeTargets="state.autoRedistributeTargets"
          :initial-tp="INIT_TP"
          currency="◎"
          :whenError="errorMessage"
          :steps="{
            'All Xs': 1,
            'All amount': 10,
            'All MC': 100000,
          }"
        />

        <div class="flex flex-wrap gap-3 flex-column md:flex-row md:align-items-end mt-3">
          <!-- MIN CALLS -->
          <div class="flex flex-column gap-2 flex-1">
            <label for="mincalls-input">Minimum calls count to show program IDS</label>
            <InputGroup>
              <InputGroupAddon>
                <i class="pi pi-megaphone"></i>
              </InputGroupAddon>
              <InputNumber
                v-model="state.minCallsForHash"
                v-bind="{ id: 'mincalls-input' }"
                showButtons
                buttonLayout="stacked"
                :min="0"
                :step="1"
                :pt="getPtNumberInput()"
                class="settingInput"
              />
            </InputGroup>
          </div>
        </div>
      </div>
    </div>

    <Toast />

    <DiffDialog
      v-if="current && showDiff"
      v-model:logsColumns="state.logsColumns"
      :archives="archives"
      :current="current"
      :screener-url="state.screenerUrl"
      chain="SOL"
      :computingParams="{
        position: state.position,
        takeProfits: JSON.parse(JSON.stringify(state.takeProfits)),
      }"
      @closed="showDiff = false"
      @ignore="ignoreCa"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import FileUpload, { type FileUploadSelectEvent } from 'primevue/fileupload'
import { CallArchive, SolCall } from './types/Call'
import { DEFAULT_SOL_SCREENER_URL, getPtNumberInput, INITIAL_TP_SIZE_CODE } from './constants'
import Toast from 'primevue/toast'
import DiffDialog from './components/DiffDialog.vue'
import ProgressSpinner from 'primevue/progressspinner'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import vTooltip from 'primevue/tooltip'
import Message from 'primevue/message'
import InputNumber from 'primevue/inputnumber'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import { Log } from './types/Log'
import {
  addTagsToHashes,
  debounce,
  downloadRowsXlsx,
  getHeaderIndexes,
  getRowsCorrespondingToLogs,
  localStorageGetObject,
  localStorageSetObject,
  sleep,
} from './lib'
import { TakeProfit } from './types/TakeProfit'
import Statistics from './components/Statistics.vue'
import Accordion from 'primevue/accordion'
import AccordionTab from 'primevue/accordiontab'
import Targets from './components/Targets.vue'
import LogsTable from './components/LogsTable.vue'
import TargetFinder from './components/TargetFinder.vue'
import useTags from './compose/useTags'
import { HashInfo } from './types/HashInfo'
import HashTable from './components/HashTable.vue'
import TimingFinder from './components/TimingFinder.vue'
import { ComputationResult } from './types/ComputationResult'
import { useRouter } from 'vue-router'
import { STORAGE_KEY } from './storage'

const router = useRouter()

const error = ref('')
const loading = ref<string | boolean>(false)
const uploading = ref(0)
const uploader = ref<InstanceType<typeof FileUpload>>()
const showDiff = ref(false)
const logs = ref<Log[]>([])
const initialized = ref(false)
const finalWorth = ref(0)
const drawdown = ref(0)
const volume = ref(0)
const worstDrawdown = ref<[string, number]>(['', 0])
const counters = ref<ComputationResult['counters']>({
  rug: 0,
  unrealistic: 0,
  postAth: 0,
  x100Sum: 0,
  x100: 0,
  x50: 0,
  x20: 0,
  x10: 0,
  x5: 0,
  x2: 0,
})

const archives = ref<CallArchive<SolCall>[]>([])
const current = ref<CallArchive<SolCall> | null>(null)
const removeArchive = (index: number) => {
  if (archives.value[index].fileName === current.value?.fileName) current.value = archives.value[0]
  archives.value.splice(index, 1)
}

const INIT_POSITION = 0.5
// prettier-ignore
const INIT_TP = [
  { "size": INITIAL_TP_SIZE_CODE, "xs": 10, "withXs": false, "mc": 50000, "withMc": false, "amount": 10, "withAmount": false, "andLogic": true },
  { "size": 33.333333333333336, "xs": 50, "withXs": true, "mc": 100000, "withMc": false, "amount": 50, "withAmount": false, "andLogic": true },
  { "size": 33.333333333333336, "xs": 50, "withXs": false, "mc": 500000, "withMc": true, "amount": 75, "withAmount": false, "andLogic": true },
  { "size": 33.333333333333336, "xs": 100, "withXs": true, "mc": 1000000, "withMc": true, "amount": 100, "withAmount": false, "andLogic": false }
] as TakeProfit[]
const INIT_FULL_STATS = false
const INIT_AUTO_REDISTRIBUTE = true
const INIT_TEXT_LOGS = false
const INIT_LOGS_COLUMNS = ['Entry MC', 'ATH MC']
const INIT_SCREENER_URL = DEFAULT_SOL_SCREENER_URL
const INIT_HASH_COLUMNS = ['Count', 'Average', 'x100', 'ATH', 'Tags']
const INIT_MIN_CALLS = 100
const state = reactive({
  position: INIT_POSITION,
  takeProfits: INIT_TP,
  showFullStats: INIT_FULL_STATS,
  autoRedistributeTargets: INIT_AUTO_REDISTRIBUTE,
  blackList: [] as string[],
  rugs: [] as string[],
  textLogs: INIT_TEXT_LOGS,
  logsColumns: INIT_LOGS_COLUMNS,
  hashColumns: INIT_HASH_COLUMNS,
  minCallsForHash: INIT_MIN_CALLS,
  screenerUrl: INIT_SCREENER_URL,
})

const STATE_STORAGE_KEY = 'state-sol-a'
function storeForm() {
  localStorageSetObject(STATE_STORAGE_KEY, state)
}
watch(state, () => storeForm(), { deep: true })
function loadForm() {
  const savedState = localStorageGetObject(STATE_STORAGE_KEY)
  if (!savedState) return

  state.position = savedState.position ?? INIT_POSITION
  state.takeProfits = savedState.takeProfits ? [...savedState.takeProfits] : INIT_TP
  state.showFullStats = savedState.showFullStats ?? INIT_FULL_STATS
  state.autoRedistributeTargets = savedState.autoRedistributeTargets ?? INIT_AUTO_REDISTRIBUTE
  state.blackList = savedState.blackList || []
  state.rugs = savedState.rugs || []
  state.textLogs = savedState.textLogs ?? INIT_TEXT_LOGS
  state.logsColumns = savedState.logsColumns ?? INIT_LOGS_COLUMNS
  state.hashColumns = savedState.hashColumns ?? INIT_HASH_COLUMNS
  state.minCallsForHash = savedState.minCallsForHash ?? INIT_MIN_CALLS
  state.screenerUrl = savedState.screenerUrl ?? INIT_SCREENER_URL
}

const ignoreCa = (ca: string, isIgnored: boolean) => {
  if (isIgnored) state.blackList.push(ca)
  else state.blackList = state.blackList.filter(_ca => _ca !== ca)

  for (const archive of archives.value) {
    archive.calls = archive.calls.map(call => ({
      ...call,
      ignored: ca === call.ca ? isIgnored : call.ignored,
    }))
  }
}

const exportXlsx = async (logs: Log[]) => {
  if (!current.value) return
  const rowsToExport = getRowsCorrespondingToLogs(logs, current.value.caColumn, current.value.rows)
  await downloadRowsXlsx(rowsToExport, `${current.value.fileName.replace('.xlsx', '')} updated`)
}

const selectedFile = computed(() => current.value?.fileName || '')
const calls = computed(() => current.value?.calls || [])
const filteredCalls = computed<SolCall[]>(() => {
  return calls.value
})

async function storeData(rows: (string | number | Date)[][], fileName: string) {
  if (rows.length <= 1) return

  const indexes = getHeaderIndexes(
    rows[0],
    [
      'mint',
      'snapshot_at',
      'created_at',
      'name',
      'post_ath',
      'xs',
      'total_supply',
      'mc',
      'current_ath_mc',
      'lp_sol_launch',
      'sol_price', // TODO: to be added
      'launched_slot',
      'current_ath_slot',
      'program_ids',
      'lp_ratio',
    ],
    message => {
      error.value = message
    },
  )

  if (!indexes) return

  let newCalls: SolCall[] = []
  for (const rowIndex in rows) {
    if (!rowIndex) return // ignore headers
    const row = rows[rowIndex]
    const parsedLaunch = row[indexes.created_at] as Date
    const parsedDate = row[indexes.snapshot_at] as Date
    // const parsedAthDate = new Date(parsedDate.getTime())
    // parsedAthDate.setSeconds(parsedAthDate.getSeconds() + athDelaySec);

    if (!parsedDate) continue
    try {
      parsedLaunch.setHours(parsedLaunch.getHours() - 1) // not sure why dates are UTC+1 in the XLSX
      parsedDate.setHours(parsedDate.getHours() - 1) // not sure why dates are UTC+1 in the XLSX
    } catch (e) {
      continue
    }
    const ca = row[indexes.mint] as string
    if (!ca) continue

    const name = (row[indexes.name] as string) || ca
    const callMc = row[indexes.mc] as number
    const supply = (row[indexes.total_supply] as number) || 1000000000
    const price = callMc / supply
    const athSlot = row[indexes.current_ath_slot] as number
    const launchSlot = row[indexes.launched_slot] as number
    const athDelaySec = athSlot && launchSlot ? (athSlot - launchSlot) * 0.4 : 2 * 60 * 60 // 0.4s per slot
    const athDelayHours = athDelaySec / 60 / 60

    let programIds = [] as string[]
    try {
      const stringPrograms = (row[indexes.program_ids] as string).replaceAll("'", '"')
      programIds = JSON.parse(stringPrograms) as string[]
    } catch (e) {}

    newCalls.push({
      name,
      ca,
      nameAndCa: (((row[indexes.name] as string) || '') + row[indexes.mint]) as string,
      date: parsedDate.toISOString(),
      postAth: (row[indexes.post_ath] as string) === 'TRUE',
      xs: Number(row[indexes.xs] as string),
      callMc,
      price,
      athDelayHours,
      ath: row[indexes.current_ath_mc] as number,
      supply,
      lp: (row[indexes.lp_sol_launch] as number) || 0,
      ignored: state.blackList.includes(ca),
      solPrice: indexes.sol_price > -1 ? (row[indexes.sol_price] as number) : 150,
      programIds,
      lpRatio: row[indexes.lp_ratio] as number,
    })

    newCalls.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

    const newArchive = { calls: newCalls, fileName, rows, caColumn: indexes.mint }
    current.value = newArchive
    const existIndex = archives.value.findIndex(a => a.fileName === newArchive.fileName)
    if (existIndex > -1) archives.value.splice(existIndex, 1, newArchive)
    else archives.value.push(newArchive)
  }
}

const runCompute = async () => {
  if (!filteredCalls.value.length) return

  loading.value = true
  await sleep(0.2) // waiting for color transition on inputs

  return worker.value?.postMessage({
    type: 'COMPUTE',
    calls: JSON.parse(JSON.stringify(filteredCalls.value)),
    position: state.position,
    takeProfits: JSON.parse(JSON.stringify(state.takeProfits)),
  })
}
const debouncedCompute = debounce(runCompute, 1000)
watch(filteredCalls, () => {
  if (!initialized.value) return
  loading.value = true
  debouncedCompute()
})
// reload when an input related to profit changes
watch(
  [() => state.position, () => state.takeProfits],
  () => {
    debouncedCompute()
  },
  { deep: true },
)

const toast = useToast()
const errorMessage = (message: string) =>
  toast.add({
    severity: 'error',
    summary: 'Wrong format for targets collection',
    life: 10000,
  })

const buyInfo = `Final wallet worth, starting from 0.<ul><li>Buy calculations: Investing selected max bag with some slippage.</li><li>Sell calculations: price impact is removed from each sale.</li><li>Investment is counted as a loss if not reaching targets.</li><li>Each sale's date is guessed from sale MC vs. ATH MC ratio: on a 1 month 4m MC token, selling at 1m means selling after 1 week.</li></ul>`

const worker = shallowRef<Worker | null>(null)
onMounted(async () => {
  loadForm()
  initialized.value = true

  const WorkerConstructor = (await import('@/worker-sol?worker')).default
  worker.value = new WorkerConstructor()
  worker.value!.onmessage = handleWorkerMessage
  worker.value!.onerror = ({ message }) => {
    error.value = message
  }
})

async function handleWorkerMessage({ data }: any) {
  if (data.type === 'XLSX') {
    uploading.value = Math.max(0, uploading.value - 1)
    return storeData(data.rows, data.fileName)
  } else if (data.type === 'COMPUTE') {
    finalWorth.value = data.finalWorth
    drawdown.value = data.drawdown
    volume.value = data.volume
    worstDrawdown.value = data.worstDrawdown
    counters.value = data.counters
    logs.value = data.logs
    programs.value = data.programs
    loading.value = false
  }
}

const onUpload = async (event: FileUploadSelectEvent) => {
  const { files } = event
  if (!files?.length) return

  const allXlsx = [...files]
  ;(uploader.value as any)?.clear()

  uploading.value = allXlsx.length
  worker.value?.postMessage({ type: 'XLSX', allXlsx })
}

const { localTags, removeTag, addTag } = useTags()
const programs = ref<Record<string, HashInfo<SolCall>>>({})
const programsWithTags = computed<HashInfo<SolCall>[]>(() =>
  addTagsToHashes(programs.value, localTags.value, state.minCallsForHash),
)

const canSeeWallets = ref(false)
try {
  canSeeWallets.value =
    !!localStorage.getItem(STORAGE_KEY.WALLET_FEATURE) ||
    router.currentRoute.value.query.wallets !== undefined
} catch (e) {
  console.error(`Failed to parse ${STORAGE_KEY.WALLET_FEATURE} storage data:`, e)
}

const showWalletsView = () => {
  const mooners = logs.value
    .filter(log => !log.flag && log.xs >= 50) // remove ignored CAs or below 100x
    .sort((a, b) => b.xs - a.xs)
    .slice(0, 50)
    .map(log => ({ ca: log.ca, xs: Math.round(log.xs), name: log.name }))

  localStorage.setItem(STORAGE_KEY.MOONERS_NEW, JSON.stringify(mooners))

  const route = router.resolve('/wallets')
  window.open(route.href, '_blank')
}
</script>
