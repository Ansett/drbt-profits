<template>
  <main>
    <div
      class="flex flex-column xl:flex-row gap-3 xl:gap-1 align-items-center xl:align-items-stretch justify-content-center"
    >
      <div class="w-screen xl:w-6 m-1 xl:m-4" style="max-width: min(95vw, 75rem)">
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
                <p class="text-center">Drag and drop a DRBT <strong>backtest export</strong></p>
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

        <Accordion :activeIndex="[0]" multiple lazy class="mt-5 h-full">
          <!-- RESULTS -->
          <AccordionTab
            header="STATISTICS"
            :pt="{
              root: { class: 'relative ' + (isSticky ? 'sticky' : '') },
            }"
          >
            <Button
              size="small"
              text
              tabindex="-1"
              class="stickyButton"
              :severity="isSticky ? 'help' : 'secondary'"
              v-tooltip.left="{
                value: isSticky ? 'Unpin' : 'Pin',
                showDelay: 500,
              }"
              @click.stop="isSticky = !isSticky"
            >
              <template #icon>
                <span class="material-symbols-outlined cursor-pointer">keep</span>
              </template>
            </Button>

            <Statistics
              :loading="loading"
              info
              :final="finalWorth"
              currency="SOL"
              :drawdown="drawdown"
              :volume="volume"
              :worstDrawdown="worstDrawdown"
              :counters="counters"
              :nbCalls="calls.length"
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
              chain="SOL"
              :screener-url="state.screenerUrl"
              :timezone="state.timezone"
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
                calls,
                position: state.position,
                averageSlippage: state.extraSlippage,
                realisticEntry: state.realisticEntry,
              }"
              v-model:xsRange="state.xsRange"
              v-model:mcRange="state.mcRange"
              v-model:amountRange="state.amountRange"
              v-model:initialKind="state.initialKind"
            />
          </AccordionTab>

          <!-- TIMING -->
          <AccordionTab header="DAILY BREAKDOWN" :pt="{ content: { class: 'p-0' } }">
            <TimingFinder
              :logs="logs"
              v-model:timeOnCreation="state.timeOnCreation"
              :withTimeRange="state.withHours"
            />
          </AccordionTab>

          <!-- PROGRAMS -->
          <AccordionTab header="PROGRAM IDS" :pt="{ content: { class: 'p-0' } }">
            <HashTable
              :lines="programsWithTags"
              filter-template="program_ids::text !~ '({})'"
              v-model:selectedColumns="state.hashColumns"
              :screener-url="state.screenerUrl"
              :timezone="state.timezone"
              @removeTag="removeTag"
              @addTag="addTag"
            />
          </AccordionTab>

          <!-- URI IMAGES -->
          <AccordionTab header="URI IMAGES" :pt="{ content: { class: 'p-0' } }">
            <HashTable
              :lines="uriImagesWithTags"
              filter-template="(uri_content::text IS NULL OR uri_content::text !~ '({})')"
              v-model:selectedColumns="state.hashColumns"
              :screener-url="state.screenerUrl"
              :timezone="state.timezone"
              showName
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
        <!-- SETTINGS SETS -->
        <div class="flex flex-column gap-2 xl:w-6">
          <label>Settings preset</label>
          <div class="flex gap-2">
            <InputGroup class="flex-1">
              <Button
                icon="pi pi-save"
                outlined
                v-tooltip.bottom="{ value: 'Duplicate current settings preset', showDelay: 500 }"
                @click="openSaveSettings"
              />
              <Dropdown
                v-model="loadedSetName"
                :options="savedSetNames"
                placeholder="Load preset…"
                class="settingInput"
                scrollHeight="312px"
                @change="onLoadSettings"
              >
                <template #option="{ option }">
                  <div class="flex align-items-center w-full gap-1">
                    <span class="flex-auto">{{ option }}</span>
                    <Button
                      icon="pi pi-pencil"
                      text
                      rounded
                      size="small"
                      aria-label="Rename"
                      @click.stop="openRenameSettings(option, $event)"
                    />
                    <Button
                      icon="pi pi-trash"
                      text
                      rounded
                      size="small"
                      aria-label="Delete"
                      @click.stop="onDeleteSettings(option)"
                    />
                  </div>
                </template>
              </Dropdown>
            </InputGroup>

            <FileUpload
              ref="stateUploader"
              mode="basic"
              accept="application/json"
              chooseLabel="&nbsp;"
              :pt="{
                chooseButton: {
                  class: 'p-button-icon-only p-button-secondary p-button-outlined h-full ml-3',
                },
              }"
              v-tooltip.bottom="{
                value: 'Import settings into a new preset',
                showDelay: 500,
              }"
              @select="importState($event)"
            >
              <template #uploadicon>
                <i class="pi pi-file-export"></i>
              </template>
            </FileUpload>
            <Button
              aria-label="Export current settings preset"
              icon="pi pi-file-import"
              outlined
              severity="secondary"
              v-tooltip.bottom="{
                value: 'Export settings',
                showDelay: 500,
              }"
              @click="exportState()"
            />
          </div>
        </div>

        <div class="flex flex-row flex-wrap gap-3 lg:gap-4 mb-3">
          <!-- POSITION -->
          <div class="flex flex-column gap-2 flex-1">
            <label for="position-input">Buy amount</label>
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
                :minFractionDigits="0"
                :maxFractionDigits="1"
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
            'All Xs': 0.5,
            'All amount': 1,
            'All MC': 1000,
          }"
        />

        <!-- DAYS & HOURS -->
        <div class="flex flex-column gap-4">
          <div class="flex gap-4">
            <div class="flex gap-2 pt-1">
              <InputSwitch v-model="state.withHours" inputId="hours-global" />
              <label for="hours-global" class="white-space-nowrap"
                >Custom trading periods<span class="text-xs"> (UTC)</span></label
              >
            </div>
            <div v-if="state.withHours" class="flex gap-2 pt-1">
              <InputSwitch v-model="state.timeOnCreation" inputId="snapshot-time" />
              <label for="snapshot-time" class="white-space-nowrap">Use created_at</label>
              <InfoButton :text="`Use created_at instead of snapshot_at`" direction="bottom" />
            </div>
          </div>

          <div v-if="state.withHours" class="card flex flex-wrap justify-content-start gap-3">
            <div
              v-for="day in allDays"
              :key="day.index"
              class="flex gap-2 flex-wrap align-items-center"
            >
              <TriStateCheckbox
                v-model="state.week[day.index]"
                :inputId="day.name"
                :pt="{
                  box: {
                    class:
                      state.week[day.index] === false
                        ? 'bg-orange-300 border-orange-300'
                        : state.week[day.index] === null
                        ? 'bg-primary border-primary'
                        : undefined,
                  },
                }"
              >
                <template #nullableicon="scope"></template>
              </TriStateCheckbox>
              <label :for="day.name" class="">
                {{ day.name + (state.week[day.index] === null ? ':' : '') }}
              </label>

              <template
                v-if="state.week[day.index] === null"
                v-for="hour in allHours"
                :key="`${day.name}-${hour}`"
              >
                <Checkbox
                  v-model="state.hours[day.index][hour]"
                  binary
                  :disabled="state.week[day.index] !== null"
                  :inputId="`${day.name}-${hour}`"
                  :pt="{
                    input: {
                      style:
                        'border: 2px solid #424b57; background: #111827; color: var(--primary-color)',
                    },
                    icon: {
                      class: 'text-primary',
                    },
                  }"
                >
                  <template #icon="scope">
                    <i
                      :class="[
                        'pi font-bold text-xs border-primary',
                        scope.checked ? 'pi-check text-primary' : 'pi-times text-orange-300',
                        scope.class,
                      ]"
                    ></i>
                  </template>
                </Checkbox>
                <label
                  :for="`${day.name}-${hour}`"
                  :class="[
                    'mr-1',
                    state.week[day.index] === null ? 'text-color-secondary' : 'text-200',
                  ]"
                >
                  {{ hour }}
                </label>
                <span v-if="hour === 11" class="flex-br" />
              </template>
              <span
                v-if="state.week[day.index] === null"
                class="ml-1 iconButton text-lg material-symbols-outlined"
                v-tooltip.bottom="{
                  value: state.hours[day.index][0] ? 'Uncheck all hours' : 'Check all hours',
                  showDelay: 500,
                }"
                @click="toggleHours(day.index)"
                >{{ state.hours[day.index][0] ? 'remove_done' : 'done_all' }}</span
              >
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-4 flex-column md:flex-row md:align-items-center mt-3">
          <!-- DEX URL -->
          <div class="flex flex-column gap-2">
            <label for="screener-input">Screener URL</label>
            <InputGroup>
              <InputGroupAddon>
                <i class="pi pi-chart-line"></i>
              </InputGroupAddon>
              <InputText
                v-model.trim="state.screenerUrl"
                id="screener-input"
                class="settingInput"
              />
            </InputGroup>
          </div>
          <!-- Timezone -->
          <div class="flex flex-column gap-2">
            <label for="timezone-input">Timezone</label>
            <InputGroup>
              <InputGroupAddon>
                <i class="pi pi-clock"></i>
              </InputGroupAddon>
              <Dropdown
                v-model="state.timezone"
                v-bind="{ id: 'timezone-input' }"
                :options="timezoneOptions"
                optionLabel="label"
                optionValue="value"
                :pt="getPtNumberInput()"
                class="settingInput"
                scrollHeight="300px"
                filter
                filterPlaceholder="Search timezone"
              />
            </InputGroup>
          </div>
          <!-- MIN CALLS -->
          <div class="flex flex-column gap-2">
            <label for="mincalls-input">Minimum for IDs/URIs</label>
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
          <!-- SLIPPAGE -->
          <div class="flex flex-column gap-2">
            <label for="slippage">Extra slippage</label>
            <InputGroup>
              <InputGroupAddon>
                <span class="material-symbols-outlined cursor-pointer">downhill_skiing</span>
              </InputGroupAddon>
              <InputNumber
                v-model="state.extraSlippage"
                v-bind="{ id: 'slippage' }"
                showButtons
                buttonLayout="stacked"
                prefix="$"
                :min="0"
                :step="100"
                :pt="getPtNumberInput()"
                class="settingInput"
                style="height: 4rem"
              />
            </InputGroup>
          </div>
          <!-- REALISTIC ENTRY -->
          <div class="flex gap-2 pt-5">
            <InputSwitch v-model="state.realisticEntry" inputId="realistic" />
            <label for="realistic" class="white-space-nowrap">Realistic entry</label>
            <InfoButton
              text="If activated, considered entry is around call slot+2 price, rather than call price"
              class="align-self-start"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Settings preset new name dropdown -->
    <OverlayPanel ref="saveSettingsPanel">
      <InputGroup>
        <InputGroupAddon>
          <i class="pi pi-bookmark"></i>
        </InputGroupAddon>
        <InputText
          ref="settingsNameInput"
          type="text"
          v-model="newSettingsName"
          placeholder="Preset name"
          maxlength="30"
          @keyup.enter="saveSettings"
        />
        <Button icon="pi pi-check" @click="saveSettings" />
      </InputGroup>
    </OverlayPanel>

    <Toast />
    <Toast group="undo">
      <template #message="slotProps">
        <div class="flex flex-row align-items-center w-full gap-3">
          <div class="flex flex-column flex-1">
            <span class="font-bold">{{ slotProps.message.summary }}</span>
          </div>
          <Button
            icon="pi pi-undo"
            label="Undo"
            size="small"
            severity="secondary"
            @click="
              () => {
                slotProps.message.data?.undo()
                toast.remove(slotProps.message)
              }
            "
          />
        </div>
      </template>
    </Toast>

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
        averageSlippage: state.extraSlippage,
        realisticEntry: state.realisticEntry,
        timeOnCreation: state.timeOnCreation,
        week: state.withHours ? state.week : undefined,
        hours: state.withHours ? state.hours : undefined,
      }"
      @closed="showDiff = false"
      @ignore="ignoreCa"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import FileUpload, { type FileUploadSelectEvent } from 'primevue/fileupload'
import { CallArchive, SolCall } from './types/Call'
import {
  DEFAULT_SOL_SCREENER_URL,
  getPtNumberInput,
  INITIAL_TP_SIZE_CODE,
} from './constants'
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
import InputText from 'primevue/inputtext'
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
  downloadDataUrl,
  getTextFileContent,
} from './lib'
import { rawRowsToSolCalls } from '../shared/sol-compute'
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
import { useTimezone } from './compose/useTimezone'
import TriStateCheckbox from 'primevue/tristatecheckbox'
import Checkbox from 'primevue/checkbox'
import InputSwitch from 'primevue/inputswitch'
import InfoButton from './components/InfoButton.vue'
import OverlayPanel from 'primevue/overlaypanel'
import { useSettings } from './compose/useSettings'
import { RawSolRow, SOL_HEADERS } from '../shared/types'

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
  offPeriods: 0,
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
  if (archives.value[index].fileName === current.value?.fileName)
    current.value = archives.value[index - 1] || null
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
const INIT_MIN_CALLS = 10
const INIT_TIMEZONE = 'UTC'
const INIT_WITH_HOURS = false
const INIT_WEEK = [true, true, true, true, true, true, true] as (boolean | null)[]
// prettier-ignore
const INIT_HOURS = [
  [ true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true ],
  [ true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true ],
  [ true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true ],
  [ true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true ],
  [ true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true ],
  [ true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true ],
  [ true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true ],
];
const INIT_EXTRA_SLIPPAGE = 0
const INIT_TIME_ON_CREATION = false
const INIT_XS_RANGE = [1, 1, 10] as [number, number, number]
const INIT_MC_RANGE = [10000, 10000, 2000000] as [number, number, number]
const INIT_AMOUNT_RANGE = [10, 10, 200] as [number, number, number]
const INIT_INITIAL_KIND = 'Xs targets' as 'Xs targets' | 'Amount targets' | 'MC targets'
const INIT_REALISTIC_ENTRY = true

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
  timezone: INIT_TIMEZONE,
  withHours: INIT_WITH_HOURS,
  week: INIT_WEEK,
  hours: INIT_HOURS,
  extraSlippage: INIT_EXTRA_SLIPPAGE,
  timeOnCreation: INIT_TIME_ON_CREATION,
  xsRange: INIT_XS_RANGE,
  mcRange: INIT_MC_RANGE,
  amountRange: INIT_AMOUNT_RANGE,
  initialKind: INIT_INITIAL_KIND,
  realisticEntry: INIT_REALISTIC_ENTRY,
})
const isSticky = ref(false)

watch(
  state,
  () => {
    const name = loadedSetName.value || 'default'
    if (!loadedSetName.value) loadedSetName.value = name

    saveSettingsSet(name, JSON.parse(JSON.stringify(state)))

    if (!savedSetNames.value.includes(name)) {
      savedSetNames.value = listSettingsSets()
    }
  },
  { deep: true },
)

const allDays = [
  { index: 1, name: 'Monday' },
  { index: 2, name: 'Tuesday' },
  { index: 3, name: 'Wednesday' },
  { index: 4, name: 'Thursday' },
  { index: 5, name: 'Friday' },
  { index: 6, name: 'Saturday' },
  { index: 0, name: 'Sunday' },
]
const allHours = Array.from({ length: 24 }, (_, index) => index)
const toggleHours = (dayIndex: number) => {
  const previous = state.hours[dayIndex][0]
  for (let h = 0; h <= 23; h++) {
    state.hours[dayIndex][h] = !previous
  }
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

function parseRows(rows: (string | number | Date)[][]): { rawRows: RawSolRow[]; caColumn: number } | null {
  if (rows.length <= 1) return null

  const indexes = getHeaderIndexes(
    rows[0],
    SOL_HEADERS,
    message => {
      error.value = message
    },
  )

  if (!indexes) return null

  const rawRows: RawSolRow[] = []
  for (const rowIndex in rows) {
    if (!rowIndex || rowIndex === '0') continue

    const row = rows[rowIndex]
    const mint = row[indexes.mint] as string
    const snapshot_at = row[indexes.snapshot_at] as Date
    if (!snapshot_at || !mint) continue

    rawRows.push({
      mint,
      snapshot_at,
      created_at: row[indexes.created_at] as Date,
      name: row[indexes.name] as string,
      post_ath: row[indexes.post_ath] as string,
      xs: row[indexes.xs] as string,
      total_supply: row[indexes.total_supply] as number,
      mc: row[indexes.mc] as number,
      entry_mc: row[indexes.entry_mc] as number,
      current_ath_mc: row[indexes.current_ath_mc] as number,
      lp_sol_launch: row[indexes.lp_sol_launch] as number,
      sol_price: row[indexes.sol_price] as number,
      launched_slot: row[indexes.launched_slot] as number,
      current_ath_slot: row[indexes.current_ath_slot] as number,
      program_ids: row[indexes.program_ids] as string,
      lp_ratio: row[indexes.lp_ratio] as number,
      uri_content: row[indexes.uri_content] as string,
    })
  }

  return { rawRows, caColumn: indexes.mint }
}

async function storeData(rows: (string | number | Date)[][], fileName: string) {
  const parsed = parseRows(rows)
  if (!parsed) return

  const newCalls = rawRowsToSolCalls(parsed.rawRows, state.blackList)
  newCalls.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const newArchive = { calls: newCalls, fileName, rows, caColumn: parsed.caColumn }
  current.value = newArchive
  const existIndex = archives.value.findIndex(a => a.fileName === newArchive.fileName)
  if (existIndex > -1) archives.value.splice(existIndex, 1, newArchive)
  else archives.value.push(newArchive)
}

const runCompute = async () => {
  if (!calls.value.length) return

  loading.value = true
  await sleep(0.2) // waiting for color transition on inputs

  return worker.value?.postMessage({
    type: 'COMPUTE',
    calls: JSON.parse(JSON.stringify(calls.value)),
    position: state.position,
    takeProfits: JSON.parse(JSON.stringify(state.takeProfits)),
    averageSlippage: state.extraSlippage,
    realisticEntry: state.realisticEntry,
    timeOnCreation: state.timeOnCreation,
    week: state.withHours ? JSON.parse(JSON.stringify(state.week)) : undefined,
    hours: state.withHours ? JSON.parse(JSON.stringify(state.hours)) : undefined,
  })
}
const debouncedCompute = debounce(runCompute, 1000)
watch(calls, () => {
  if (!initialized.value) return
  loading.value = true
  debouncedCompute()
})
// reload when an input related to profit changes
watch(
  [
    () => state.position,
    () => state.takeProfits,
    () => state.extraSlippage,
    () => state.realisticEntry,
    () => state.timeOnCreation,
    () => state.withHours,
    () => state.week,
    () => state.hours,
  ],
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

const {
  listSettingsSets,
  saveSettingsSet,
  loadSettingsSet,
  deleteSettingsSet,
  getLastSettingsName,
  setLastSettingsName,
} = useSettings('sol-settings')

const saveSettingsPanel = ref<InstanceType<typeof OverlayPanel>>()
const settingsNameInput = ref()
const newSettingsName = ref('')
const savedSetNames = ref<string[]>(listSettingsSets())
const loadedSetName = ref<string | null>('default')
const renamingPreset = ref<string | null>(null)

const applyState = (stored: Record<string, any>) => {
  for (const key in stored) {
    // Preserve array references to avoid breaking reactivity in child components
    if (Array.isArray(stored[key]) && Array.isArray((state as any)[key])) {
      ;(state as any)[key].splice(0, (state as any)[key].length, ...stored[key])
    } else {
      ;(state as any)[key] = stored[key]
    }
  }
}

const openSaveSettings = async (event: MouseEvent) => {
  renamingPreset.value = null
  savedSetNames.value = listSettingsSets()
  newSettingsName.value = loadedSetName.value ?? ''
  saveSettingsPanel.value?.show(event)
  await nextTick()
  settingsNameInput.value?.$el.focus()
  settingsNameInput.value?.$el.select()
}

const openRenameSettings = async (name: string, event: MouseEvent) => {
  renamingPreset.value = name
  newSettingsName.value = name
  saveSettingsPanel.value?.show(event)
  await nextTick()
  settingsNameInput.value?.$el.focus()
  settingsNameInput.value?.$el.select()
}

const saveSettings = () => {
  // Keep only alphanumeric, spaces, dashes, and underscores
  const baseName = newSettingsName.value.replace(/[^a-zA-Z0-9 _-]/g, '').trim()
  if (!baseName) return

  if (renamingPreset.value) {
    if (baseName === renamingPreset.value) {
      saveSettingsPanel.value?.hide()
      renamingPreset.value = null
      return
    }

    let newName = baseName
    let counter = 1
    while (savedSetNames.value.includes(newName)) {
      newName = `${baseName} (${counter})`
      counter++
    }

    const data = loadSettingsSet(renamingPreset.value)
    if (data) {
      saveSettingsSet(newName, data)
      deleteSettingsSet(renamingPreset.value)
      savedSetNames.value = listSettingsSets()

      if (loadedSetName.value === renamingPreset.value) {
        loadedSetName.value = newName
        setLastSettingsName(newName)
      }

      toast.add({ severity: 'success', summary: `Preset renamed to "${newName}"`, life: 3000 })
    }
    saveSettingsPanel.value?.hide()
    renamingPreset.value = null
  } else {
    saveSettingsSet(baseName, JSON.parse(JSON.stringify(state)))
    savedSetNames.value = listSettingsSets()
    loadedSetName.value = baseName
    setLastSettingsName(baseName)
    saveSettingsPanel.value?.hide()
    toast.add({ severity: 'success', summary: `Preset "${baseName}" saved`, life: 3000 })
  }
}

const onLoadSettings = () => {
  if (!loadedSetName.value) {
    loadedSetName.value = 'default'
  }

  const stored = loadSettingsSet(loadedSetName.value)
  if (stored) applyState(stored)

  setLastSettingsName(loadedSetName.value)
  toast.add({ severity: 'info', summary: `Preset "${loadedSetName.value}" loaded`, life: 3000 })
}

const onDeleteSettings = (name: string) => {
  const currentIndex = savedSetNames.value.indexOf(name)
  let nextName = 'default'
  if (currentIndex > 0) {
    nextName = savedSetNames.value[currentIndex - 1]
  } else if (savedSetNames.value.length > 1) {
    nextName = savedSetNames.value[1]
  }

  const deletedState = loadSettingsSet(name)

  deleteSettingsSet(name)
  savedSetNames.value = listSettingsSets()

  if (loadedSetName.value === name) {
    loadedSetName.value = nextName
    setLastSettingsName(nextName)
    const stored = loadSettingsSet(nextName)
    if (stored) {
      applyState(stored)
    } else {
      saveSettingsSet(nextName, JSON.parse(JSON.stringify(state)))
      savedSetNames.value = listSettingsSets()
    }
  }

  toast.removeGroup('undo')

  toast.add({
    severity: 'warn',
    summary: `Preset "${name}" deleted`,
    life: 15000,
    group: 'undo',
    data: {
      undo: () => {
        if (deletedState) {
          saveSettingsSet(name, deletedState)
          savedSetNames.value = listSettingsSets()
          loadedSetName.value = name
          setLastSettingsName(name)
          applyState(deletedState)
          toast.add({ severity: 'success', summary: `Preset "${name}" restored`, life: 3000 })
        }
      },
    },
  } as any)
}

const stateUploader = ref<InstanceType<typeof FileUpload>>()

const exportState = () => {
  const data = JSON.stringify(state, null, 2)
  const dataUrl = window.URL.createObjectURL(new Blob([data], { type: 'application/json' }))
  downloadDataUrl(dataUrl, `${loadedSetName.value || 'default'}.json`)
}

const importState = async (event: FileUploadSelectEvent) => {
  const { files } = event
  if (!files?.length) return
  const file = files[0]
  const text = await getTextFileContent(file)
  ;(stateUploader.value as any)?.clear()

  try {
    const importedState = JSON.parse(text)

    if (Array.isArray(importedState) && importedState.length > 0 && 'size' in importedState[0]) {
      // Legacy Take Profits export
      applyState({ takeProfits: importedState })
      toast.add({ severity: 'success', summary: 'Legacy targets imported', life: 3000 })
    } else if ('position' in importedState) {
      // Full state import
      let baseName = file.name.replace(/\.[^/.]+$/, '')
      let newName = baseName
      let counter = 1
      while (savedSetNames.value.includes(newName)) {
        newName = `${baseName} (${counter})`
        counter++
      }

      applyState(importedState)
      saveSettingsSet(newName, JSON.parse(JSON.stringify(state)))
      savedSetNames.value = listSettingsSets()
      loadedSetName.value = newName
      setLastSettingsName(newName)

      toast.add({ severity: 'success', summary: `Settings imported as "${newName}"`, life: 3000 })
    } else {
      throw new Error()
    }
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Invalid settings file', life: 3000 })
  }
}

const buyInfo = `Final wallet worth, starting from 0.<ul><li>Buy calculations: Investing selected max bag with some slippage.</li><li>Sell calculations: price impact is removed from each sale.</li><li>Investment is counted as a loss if not reaching targets.</li><li>Each sale's date is guessed from sale MC vs. ATH MC ratio: on a 1 month 4m MC token, selling at 1m means selling after 1 week.</li></ul>`

const worker = shallowRef<Worker | null>(null)
onMounted(async () => {
  const lastName = getLastSettingsName() || 'default'
  loadedSetName.value = lastName
  const stored = loadSettingsSet(lastName)

  if (stored) {
    applyState(stored)
  } else {
    const legacyState = localStorageGetObject('state-sol-a')
    if (legacyState) {
      applyState(legacyState)
    }
    saveSettingsSet(lastName, JSON.parse(JSON.stringify(state)))
    savedSetNames.value = listSettingsSets()
  }
  setLastSettingsName(lastName)

  initialized.value = true

  const WorkerConstructor = (await import('@/worker-sol?worker')).default
  worker.value = new WorkerConstructor()
  worker.value!.onmessage = handleWorkerMessage
  worker.value!.onerror = ({ message }) => {
    error.value = message
  }
})

async function handleWorkerMessage({ data }: any) {
  if (data.type === 'PARSED_XLSX') {
    uploading.value = Math.max(0, uploading.value - 1)
    return storeData(data.rows, data.fileName)
  } else if (data.type === 'COMPUTED') {
    finalWorth.value = data.finalWorth
    drawdown.value = data.drawdown
    volume.value = data.volume
    worstDrawdown.value = data.worstDrawdown
    counters.value = data.counters
    logs.value = data.logs
    programs.value = data.programs
    uriImages.value = data.uriImages
    loading.value = false
  }
}

const onUpload = async (event: FileUploadSelectEvent) => {
  const { files } = event
  if (!files?.length) return

  const allXlsx = [...files]
  ;(uploader.value as any)?.clear()

  uploading.value = allXlsx.length
  worker.value?.postMessage({ type: 'PARSE_XLSX', allXlsx })
}

const { localTags, removeTag, addTag } = useTags()
const programs = ref<Record<string, HashInfo<SolCall>>>({})
const programsWithTags = computed<HashInfo<SolCall>[]>(() =>
  addTagsToHashes(programs.value, localTags.value, state.minCallsForHash),
)
const uriImages = ref<Record<string, HashInfo<SolCall>>>({})
const uriImagesWithTags = computed<HashInfo<SolCall>[]>(() =>
  addTagsToHashes(uriImages.value, localTags.value, state.minCallsForHash),
)

const { timezoneOptions } = useTimezone()

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

<style scoped>
.stickyButton {
  position: absolute;
  right: 0.5rem;
  top: 0.5rem;
  z-index: 2;
}
.stickyButton:focus,
.stickyButton:active {
  box-shadow: none !important;
  border-color: transparent !important;
}
</style>
