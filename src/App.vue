<template>
  <header
    class="text-xl md:text-3xl lg:text-4xl xl:text-5xl font-light text-color-secondary text-center xl:text-left my-2 ml-0 xl:ml-6 flex flex-row align-items-center"
  >
    <span class="flex-auto">Backtesting profits from DRBT</span>

    <Button
      icon="pi pi-heart-fill"
      aria-label="Donate"
      outlined
      rounded
      class="w-2rem h-2rem md:w-3rem md:h-3rem mx-1 md:mx-2 xl:mx-4"
      @click="showDonation = true"
    />
  </header>

  <main>
    <!-- CONFIG -->
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
                    aria-label="Current calls file"
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
              :finalETH="finalETH"
              :drawdown="drawdown"
              :worstDrawdown="worstDrawdown"
              :counters="counters"
              :nbCalls="filteredCalls.length"
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
              v-model:selectedColumns="state.logColumns"
              withDisplaySwitch
            />
          </AccordionTab>

          <!-- TARGETS -->
          <AccordionTab header="TARGET SIMULATOR" :pt="{ content: { class: 'p-0' } }">
            <TargetFinder
              :data="{
                calls: filteredCalls,
                position: state.position,
                gweiDelta: state.gweiDelta,
                buyTaxInXs: state.buyTaxInXs,
                feeInXs: state.feeInXs,
                slippageGuessing: state.slippageGuessing,
              }"
            />
          </AccordionTab>

          <!-- ATH -->
          <AccordionTab header="ATH DELAY" :pt="{ content: { class: 'p-0' } }">
            <AthStatistics :calls="filteredCalls" />
          </AccordionTab>

          <!-- TIMING -->
          <AccordionTab header="DAILY BREAKDOWN" :pt="{ content: { class: 'p-0' } }">
            <TimingFinder :logs="logs" :limited="state.withHours" />
          </AccordionTab>

          <!-- HASHES -->
          <AccordionTab header="FUNCTIONS HASH" :pt="{ content: { class: 'p-0' } }">
            <HashTable
              :lines="hashesWithTags"
              filter-template="~HashF.str.contains('{}', na=False)"
              v-model:selectedColumns="state.hashColumns"
              @removeTag="removeTag"
              @addTag="addTag"
            />
          </AccordionTab>

          <!-- SIGNATURES -->
          <AccordionTab header="FUNCTION SIGNATURE" :pt="{ content: { class: 'p-0' } }">
            <HashTable
              :lines="signaturesWithTags"
              filter-template="~FList.str.contains('{}', na=False)"
              v-model:selectedColumns="state.hashColumns"
              @removeTag="removeTag"
              @addTag="addTag"
            />
          </AccordionTab>
        </Accordion>
      </div>

      <div
        class="flex flex-column mx-1 xl:mx-4 my-2 gap-3 lg:gap-4"
        style="max-width: min(95vw, 50rem)"
      >
        <!-- POSITION -->
        <div class="flex flex-column gap-2">
          <label for="position-input">Max bag</label>
          <InputGroup>
            <InputGroupAddon>
              <i class="pi pi-wallet"></i>
            </InputGroupAddon>
            <InputNumber
              v-model="state.position"
              id="position-input"
              showButtons
              buttonLayout="stacked"
              suffix=" ETH"
              :min="0.005"
              :minFractionDigits="1"
              :maxFractionDigits="3"
              mode="decimal"
              :step="0.005"
              :pt="ptNumberInput"
              class="settingInput"
              style="height: 4rem"
            />
          </InputGroup>
        </div>
        <!-- GAP PRICE -->
        <div class="flex flex-column gap-2">
          <label for="gwei-input">Buy GWEI delta</label>
          <InputGroup>
            <InputGroupAddon>
              <span class="material-symbols-outlined">local_gas_station</span>
            </InputGroupAddon>
            <InputNumber
              v-model="state.gweiDelta"
              id="gwei-input"
              showButtons
              buttonLayout="stacked"
              :min="1"
              :step="1"
              :pt="ptNumberInput"
              class="settingInput"
              style="height: 4rem"
            />
          </InputGroup>
        </div>
        <!-- TP -->
        <div
          v-for="(takeProfit, index) in state.takeProfits"
          :key="index"
          class="flex flex-row flex-wrap gap-2"
        >
          <label :for="'tp-input' + index" class="min-w-full"
            >Take profit target {{ index + 1 }}
            <span class="text-xs">(size % and first encountered X or MC)</span>
          </label>

          <!-- TP size -->
          <InputGroup class="flex-1">
            <InputGroupAddon>
              <i class="pi pi-send target-icon"></i>
            </InputGroupAddon>
            <InputNumber
              v-model="takeProfit.size"
              :id="'tp-input' + index"
              showButtons
              buttonLayout="stacked"
              style="height: 4rem"
              suffix="%"
              :min="0"
              :max="getMaxSize(index)"
              :step="10"
              :pt="ptNumberInput"
              class="settingInputSmall"
            />
          </InputGroup>
          <!-- TP Xs -->
          <InputGroup class="flex-1">
            <InputNumber
              v-model="takeProfit.xs"
              showButtons
              buttonLayout="stacked"
              style="height: 4rem"
              suffix="x"
              :min="1"
              :step="5"
              :pt="ptNumberInput"
              :disabled="!takeProfit.withXs"
              class="settingInputSmall"
            />
            <InputGroupAddon>
              <Checkbox v-model="takeProfit.withXs" binary />
            </InputGroupAddon>
          </InputGroup>
          <!-- TP MC -->
          <InputGroup class="flex-1">
            <InputNumber
              v-model="takeProfit.mc"
              showButtons
              buttonLayout="stacked"
              style="height: 4rem"
              prefix="$"
              :min="0"
              :step="100000"
              :pt="ptNumberInput"
              :disabled="!takeProfit.withMc"
              class="settingInput"
            />
            <InputGroupAddon>
              <Checkbox v-model="takeProfit.withMc" binary />
            </InputGroupAddon>
          </InputGroup>
          <Button
            v-if="index > 0"
            icon="pi pi-times"
            severity="secondary"
            text
            aria-label="Remove"
            @click="removeTarget(index)"
          />
        </div>

        <div
          class="flex flex-column md:flex-row flex-wrap align-items-start md:align-items-center gap-2"
        >
          <Button class="m-3 align-self-start" @click="addTarget">Add a target</Button>

          <div class="flex flex-row gap-2 align-items-center pl-3">
            <Checkbox inputId="taxOption" v-model="state.buyTaxInXs" binary class="flex-shrink-0" />
            <label for="taxOption">Tax impacts target </label>
            <InfoButton
              text="If activated, buy tax lowers Xs and thus impacts targets. If not activated, buy tax only impacts final profit and not targets"
              class="align-self-start"
            />
          </div>
          <div class="flex flex-row gap-2 align-items-center pl-3">
            <Checkbox inputId="feeOption" v-model="state.feeInXs" binary class="flex-shrink-0" />
            <label for="feeOption">Gas impacts target </label>
            <InfoButton
              text="If activated, Xs target is using the same calculation than sniper bots [profit% = worth/(initial+gas)). If not activated, Xs target is just targetPrice/entryPrice. Whichever you choose, gas cost is just a flat value deduced from profit."
              class="align-self-start"
            />
          </div>
          <div class="flex flex-row gap-2 align-items-center pl-3">
            <Checkbox
              inputId="slippageOption"
              v-model="state.slippageGuessing"
              binary
              class="flex-shrink-0"
            />
            <label for="slippageOption">Guess slippage </label>
            <InfoButton
              :text="`By default, buy slippage is ${DEFAULT_SLIPPAGE}%. But with this option, for block 1 or 2 buys, the algorithm tries to guess a more realistic, but still very imperfect, slippage with the help of block 0 snipes data`"
              class="align-self-start"
            />
          </div>
        </div>

        <!-- START -->
        <div class="flex flex-row flex-wrap gap-2">
          <label for="start-input" class="min-w-full"
            >Start date <span class="text-xs">(no limit if empty)</span></label
          >

          <InputGroup class="flex-50">
            <InputGroupAddon>
              <span class="material-symbols-outlined">today</span>
            </InputGroupAddon>
            <Button icon="pi pi-minus" outlined severity="secondary" @click="incStartDate(-1)" />
            <InputMask
              v-model="selection.startDate"
              id="start-input"
              style="height: 4rem"
              mask="9999-99-99"
              placeholder="YYYY-MM-DD"
              class="settingInput"
            />
            <Button icon="pi pi-plus" outlined severity="secondary" @click="incStartDate()" />
          </InputGroup>
          <InputGroup class="flex-1">
            <InputMask
              v-model="selection.startHour"
              style="height: 4rem"
              mask="99:99"
              placeholder="00:00"
              class="settingInputSmall"
            />
            <!-- prettier-ignore -->
            <Button
              icon="pi pi-times"
              outlined
              severity="secondary"
              @click="
                selection.startDate = '';
                selection.startHour = '';
              "
            />
          </InputGroup>
        </div>
        <!-- END DATE -->
        <div class="flex flex-row flex-wrap gap-2">
          <label for="end-input" class="min-w-full"
            >End date <span class="text-xs">(no limit if empty)</span></label
          >
          <InputGroup class="flex-50">
            <InputGroupAddon>
              <span class="material-symbols-outlined">event</span>
            </InputGroupAddon>
            <Button icon="pi pi-minus" outlined severity="secondary" @click="incEndDate(-1)" />
            <InputMask
              v-model="selection.endDate"
              id="end-input"
              style="height: 4rem"
              mask="9999-99-99"
              placeholder="YYYY-MM-DD"
              class="settingInput"
            />
            <Button icon="pi pi-plus" outlined severity="secondary" @click="incEndDate()" />
          </InputGroup>
          <InputGroup class="flex-1">
            <InputMask
              v-model="selection.endHour"
              style="height: 4rem"
              mask="99:99"
              placeholder="00:00"
              class="settingInputSmall"
            />
            <!-- prettier-ignore -->
            <Button
              icon="pi pi-times"
              outlined
              severity="secondary"
              @click="
                selection.endDate = '';
                selection.endHour = '';
              "
            />
          </InputGroup>
        </div>
        <!-- DAYS & HOURS -->
        <div class="flex flex-column gap-4">
          <div class="flex gap-2 pt-1">
            <InputSwitch v-model="state.withHours" inputId="hours-global" />
            <label for="hours-global"
              >Custom trading periods<span class="text-xs"> (UTC)</span></label
            >
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
                  checkbox: {
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

              <template v-for="hour in allHours" :key="`${day.name}-${hour}`">
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

        <!-- MIN CALLS -->
        <div class="flex flex-column gap-2">
          <label for="mincalls-input">Minimum calls count to show hashes and signatures</label>
          <InputGroup>
            <InputGroupAddon>
              <i class="pi pi-megaphone"></i>
            </InputGroupAddon>
            <InputNumber
              v-model="state.minCallsForHash"
              id="mincalls-input"
              showButtons
              buttonLayout="stacked"
              style="height: 4rem"
              :min="1"
              :step="10"
              :pt="ptNumberInput"
              class="settingInput"
            />
          </InputGroup>
        </div>
      </div>
    </div>

    <Toast />

    <DiffDialog
      v-if="current && showDiff"
      v-model:logColumns="state.logColumns"
      :archives="archives"
      :current="current"
      :computingParams="{
        position: state.position,
        gweiDelta: state.gweiDelta,
        buyTaxInXs: state.buyTaxInXs,
        feeInXs: state.feeInXs,
        slippageGuessing: state.slippageGuessing,
        takeProfits: JSON.parse(JSON.stringify(state.takeProfits)),
      }"
      @closed="showDiff = false"
    />

    <Dialog
      v-model:visible="showDonation"
      modal
      dismissableMask
      :style="{
        maxWidth: '80%',
        width: '36rem',
      }"
    >
      <template #header>&nbsp;</template>
      <p>
        If you want to donate anything so I can invest more time to improve the tool, I'll gladly
        accept transfers to:
      </p>
      <ul class="bullets">
        <li>
          <CaLink ca="0xc6939FeC2cb696B6A4f7CD6fE8070f0C16eB85d9" wallet />
          (Ethereum, Polygon, Base, Avalanche)
        </li>
        <li>
          <CaLink ca="3yTeS4b5BcwMNBdxL2w1cysFDrUPcT21ZvQHpwErJLrL" wallet />
          (Solana)
        </li>
      </ul>
      <p class="mt-3">Thanks wholeheartedly :D</p>
    </Dialog>
  </main>
</template>

<script setup lang="ts">
// https://primevue.org/icons/#list
// https://primeflex.org/flexdirection
// https://fonts.google.com/icons?selected=Material+Symbols+Outlined:thumb_up:FILL@0;wght@400;GRAD@0;opsz@24&icon.set=Material+Symbols&icon.style=Outlined
import ProgressSpinner from 'primevue/progressspinner'
import InputNumber from 'primevue/inputnumber'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import FileUpload, { type FileUploadSelectEvent } from 'primevue/fileupload'
import Accordion from 'primevue/accordion'
import AccordionTab from 'primevue/accordiontab'
import Message from 'primevue/message'
import InputMask from 'primevue/inputmask'
import InputSwitch from 'primevue/inputswitch'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import TriStateCheckbox from 'primevue/tristatecheckbox'
import HashTable from './components/HashTable.vue'
import DiffDialog from './components/DiffDialog.vue'
import InfoButton from './components/InfoButton.vue'
import Dialog from 'primevue/dialog'
import Toast from 'primevue/toast'
import Dropdown from 'primevue/dropdown'
import vTooltip from 'primevue/tooltip'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  debounce,
  decimalHourToString,
  localStorageSetObject,
  localStorageGetObject,
  addTagsToHashes,
  sumObjectProperty,
  sleep,
  round,
} from './lib'
import { type CallArchive, type Call, type DiffType } from './types/Call'
import type { Log } from './types/Log'
import Worker from './worker?worker'
import type { TakeProfit } from './types/TakeProfit'
import type { HashInfo } from './types/HashInfo'
import LogsTable from './components/LogsTable.vue'
import TargetFinder from './components/TargetFinder.vue'
import CaLink from './components/CaLink.vue'
import TimingFinder from './components/TimingFinder.vue'
import { ptNumberInput, ETH_PRICE, SELL_TAX, SELL_GAS_PRICE, DEFAULT_SLIPPAGE } from './constants'
import Statistics from './components/Statistics.vue'
import AthStatistics from './components/AthStatistics.vue'

const error = ref('')
const loading = ref(false)
const uploading = ref(0)
const uploader = ref<InstanceType<typeof FileUpload>>()
const showDonation = ref(false)

const onUpload = async (event: FileUploadSelectEvent) => {
  const { files } = event
  if (!files?.length) return

  const allXlsx = [...files]
  ;(uploader.value as any)?.clear()

  uploading.value = allXlsx.length
  worker.postMessage({ type: 'XLSX', allXlsx })
}

const showDiff = ref(false)
const logs = ref<Log[]>([])
const TAGS_STORAGE_KEY = 'tags'
const localTags = ref<Record<string, string[]>>(localStorageGetObject(TAGS_STORAGE_KEY) || {})

const removeTag = (hash: string, index: number) => {
  localTags.value[hash]?.splice(index, 1)
}
const addTag = (hash: string, newTag: string) => {
  if (!localTags.value[hash]) localTags.value[hash] = []
  localTags.value[hash].push(newTag)
}
watch(
  localTags,
  () => {
    localStorageSetObject(TAGS_STORAGE_KEY, localTags.value)
  },
  { deep: true },
)

const hashes = ref<Record<string, HashInfo>>({})
const hashesWithTags = computed<HashInfo[]>(() =>
  addTagsToHashes(hashes.value, localTags.value, state.minCallsForHash),
)
const signatures = ref<Record<string, HashInfo>>({})
const signaturesWithTags = computed<HashInfo[]>(() =>
  addTagsToHashes(signatures.value, localTags.value, state.minCallsForHash),
)

const archives = ref<CallArchive[]>([])
const current = ref<CallArchive | null>(null)
const removeArchive = (index: number) => {
  if (archives.value[index].fileName === current.value?.fileName) current.value = archives.value[0]
  archives.value.splice(index, 1)
}

const selectedFile = computed(() => current.value?.fileName || '')
const calls = computed(() => current.value?.calls || [])
const filteredCalls = computed<Call[]>(() =>
  calls.value.filter(call => {
    // filtering period
    if (selection.startDate) {
      const time = selection.startHour?.match(/\d\d:\d\d/) ? selection.startHour : '00:00'
      const fullStart = `${selection.startDate}T${time}:00.000Z`
      if (call.date < fullStart) return false
    }
    if (selection.endDate) {
      const time = selection.endHour?.match(/\d\d:\d\d/) ? selection.endHour : '00:00'
      const fullEnd = `${selection.endDate}T${time}:00.000Z`
      if (call.date > fullEnd) return false
    }

    // filtering trading hours and days
    if (state.withHours && state.week.some(active => !active)) {
      const date = new Date(call.date)
      const callDay = date.getUTCDay()
      if (state.week[callDay]) return true
      else if (state.week[callDay] === false) return false
      // when null: costom hours
      const callHour = date.getUTCHours()
      return state.hours[callDay][callHour]
    }

    return true
  }),
)

const getHeaderIndexes = <T extends string>(
  header: (string | number | Date)[],
  names: T[],
): Record<T, number> | null => {
  const indexes = {} as Record<T, number>

  for (const name of names) {
    const allIndexes = header.flatMap((h, i) => (h === name ? i : []))
    if (!allIndexes.length) return fail(`${name} header not found`)

    // if the same header is present multiple time in sheet (ie. CRT_MC), take the last one
    indexes[name] = allIndexes.length > 1 ? allIndexes[allIndexes.length - 1] : allIndexes[0]
    header.indexOf(name)
  }

  return indexes
}
async function storeData(rows: (string | number | Date)[][], fileName: string) {
  if (rows.length <= 1) return

  const indexes = getHeaderIndexes(rows[0], [
    'LiveAt',
    'Name',
    'CA',
    'Rug',
    'CRT_ATH_MC', // ATH at the time of export
    'CRT_ATH_Date',
    'ATH_MC', // ATH at the time of call
    'TSupply',
    'MaxBuyPRCT', // MaxBuy is not realiable, using percentage instead
    'CRT_MC', // taking the second column with same name, the first one is MC at present time, not call-time
    'HashF',
    'BuyTax',
    'Logged',
    'LaunchedDelay',
    'FList',
    'GWEI',
    'Gas',
    'Snipes',
    'PriorityMin',
    'PriorityMax',
    'PriorityAVG',
    'LP_CRT',
  ])

  if (!indexes) return

  let newCalls: Call[] = []
  for (const rowIndex in rows) {
    if (!rowIndex) return // ignore headers
    const row = rows[rowIndex]
    const parsedLaunch = row[indexes.LiveAt] as Date
    const parsedDate = row[indexes.Logged] as Date
    const parsedAthDate = row[indexes.CRT_ATH_Date] as Date
    if (!parsedDate || !parsedAthDate) continue
    try {
      parsedLaunch.setHours(parsedLaunch.getHours() - 1) // not sure why dates are UTC+1 in the XLSX
      parsedDate.setHours(parsedDate.getHours() - 1) // not sure why dates are UTC+1 in the XLSX
      parsedAthDate.setHours(parsedAthDate.getHours() - 1) // not sure why dates are UTC+1 in the XLSX
    } catch (e) {
      continue
    }
    const ca = row[indexes.CA] as string
    const supply = row[indexes.TSupply] as number
    const callMc = row[indexes.CRT_MC] as number
    const price = callMc / supply
    const ath = row[indexes.CRT_ATH_MC] as number
    const xs = ath / callMc
    const athDelayHours = (parsedAthDate.getTime() - parsedLaunch.getTime()) / (1000 * 60 * 60)

    newCalls.push({
      name: row[indexes.Name] as string,
      ca,
      nameAndCa: ((row[indexes.Name] as string) + row[indexes.CA]) as string,
      price,
      supply,
      callMc,
      buyTax: (row[indexes.BuyTax] as number) / 100,
      ath,
      athDate: parsedAthDate.toISOString(),
      athDelayHours,
      xs,
      callTimeAth: row[indexes.ATH_MC] as number,
      date: parsedDate.toISOString(),
      delay: row[indexes.LaunchedDelay] as number,
      fList: row[indexes.FList] as string,
      maxBuy: ((row[indexes.MaxBuyPRCT] as number) || 100) / 100,
      rug: !!row[indexes.Rug],
      hashF: row[indexes.HashF] as string,
      gwei: row[indexes.GWEI] as number,
      buyGas: (row[indexes.Gas] as number) || 200000,
      nbSnipes: row[indexes.Snipes] as number,
      lp: row[indexes.LP_CRT] as number,
    })
  }

  newCalls.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const newArchive = { calls: newCalls, fileName, rows, caColumn: indexes.CA }
  current.value = newArchive
  const existIndex = archives.value.findIndex(a => a.fileName === newArchive.fileName)
  if (existIndex > -1) archives.value.splice(existIndex, 1, newArchive)
  else archives.value.push(newArchive)
}

const INIT_POSITION = 0.05
const INIT_TP = {
  size: 100,
  xs: 50,
  withXs: true,
  mc: 1000000,
  withMc: true,
} as TakeProfit
const INIT_GWEI = 5
const INIT_MIN_CALLS = 5
const INIT_HASH_COLUMNS = ['Count', 'Average', 'x10', 'x50', 'Tags']
const INIT_LOG_COLUMNS = ['Invested', 'Entry MC', 'Slippage', 'ATH MC']
const INIT_TEXT_LOGS = false
const INIT_DIFF_TYPES = ['ADDED', 'REMOVED'] as DiffType[]
const INIT_BUY_TAX_IN_XS = true
const INIT_FEE_IN_XS = true
const INIT_SLIPPAGE_GUESSING = true
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
const state = reactive({
  position: INIT_POSITION,
  takeProfits: [INIT_TP],
  gweiDelta: INIT_GWEI,
  minCallsForHash: INIT_MIN_CALLS,
  hashColumns: INIT_HASH_COLUMNS,
  logColumns: INIT_LOG_COLUMNS,
  textLogs: INIT_TEXT_LOGS,
  buyTaxInXs: INIT_BUY_TAX_IN_XS,
  feeInXs: INIT_FEE_IN_XS,
  slippageGuessing: INIT_SLIPPAGE_GUESSING,
  withHours: INIT_WITH_HOURS,
  week: INIT_WEEK,
  hours: INIT_HOURS,
})

const selection = reactive({
  startDate: '',
  startHour: '',
  endDate: '',
  endHour: '',
})

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

const initialized = ref(false)
const finalETH = ref(0)
const drawdown = ref(0)
const worstDrawdown = ref<[string, number]>(['', 0])
const counters = ref({
  rug: 0,
  unrealistic: 0,
  postAth: 0,
  x100: 0,
  x50: 0,
  x10: 0,
})

const STATE_STORAGE_KEY = 'state-c'
function storeForm() {
  localStorageSetObject(STATE_STORAGE_KEY, state)
}
watch(state, () => storeForm(), { deep: true })
function loadForm() {
  const savedState = localStorageGetObject(STATE_STORAGE_KEY)
  if (!savedState) return

  state.position = savedState.position ?? INIT_POSITION
  state.takeProfits = savedState.takeProfits ?? [INIT_TP]
  state.gweiDelta = savedState.gweiDelta ?? INIT_GWEI
  state.minCallsForHash = savedState.minCallsForHash ?? INIT_MIN_CALLS
  state.hashColumns = savedState.hashColumns ?? INIT_HASH_COLUMNS
  state.logColumns = savedState.logColumns ?? INIT_LOG_COLUMNS
  state.textLogs = savedState.textLogs ?? INIT_TEXT_LOGS
  state.buyTaxInXs = savedState.buyTaxInXs ?? INIT_BUY_TAX_IN_XS
  state.feeInXs = savedState.feeInXs ?? INIT_FEE_IN_XS
  state.slippageGuessing = savedState.slippageGuessing ?? INIT_SLIPPAGE_GUESSING
  state.withHours = savedState.withHours ?? INIT_WITH_HOURS
  state.week = savedState.week ?? INIT_WEEK
  state.hours = savedState.hours ?? INIT_HOURS
}
onMounted(() => {
  loadForm()
  initialized.value = true
})

const toggleHours = (dayIndex: number) => {
  const previous = state.hours[dayIndex][0]
  for (let h = 0; h <= 23; h++) {
    state.hours[dayIndex][h] = !previous
  }
}

const addTarget = () => {
  const lastTarget = state.takeProfits[state.takeProfits.length - 1]
  const remainingPct = 100 - sumObjectProperty(state.takeProfits, tp => tp.size)
  state.takeProfits.push({
    ...INIT_TP,
    ...lastTarget,
    size: remainingPct,
  })
}
const removeTarget = (index: number) => {
  state.takeProfits.splice(index, 1)
}

const getMaxSize = (index: number): number => {
  const otherTps = [...state.takeProfits]
  otherTps.splice(index, 1)
  return 100 - sumObjectProperty(otherTps, tp => tp.size)
}

const incStartDate = (inc = 1) => {
  const base = selection.startDate || filteredCalls.value[0]?.date || ''
  if (!base) return
  const offset = selection.startDate ? inc : 0
  const current = new Date(base)
  current.setDate(current.getDate() + offset)
  selection.startDate = current.toISOString().split('T')[0]
}
const incEndDate = (inc = 1) => {
  const base = selection.endDate || filteredCalls.value[filteredCalls.value.length - 1]?.date || ''
  if (!base) return
  const offset = selection.endDate ? inc : 1
  const current = new Date(base)
  current.setDate(current.getDate() + offset)
  selection.endDate = current.toISOString().split('T')[0]
}

const runCompute = async () => {
  if (!filteredCalls.value.length) return

  loading.value = true
  await sleep(0.2) // waiting for color transition on inputs

  return worker.postMessage({
    type: 'COMPUTE',
    calls: JSON.parse(JSON.stringify(filteredCalls.value)),
    position: state.position,
    gweiDelta: state.gweiDelta,
    buyTaxInXs: state.buyTaxInXs,
    feeInXs: state.feeInXs,
    slippageGuessing: state.slippageGuessing,
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
  [
    () => state.position,
    () => state.takeProfits,
    () => state.gweiDelta,
    () => state.buyTaxInXs,
    () => state.feeInXs,
    () => state.slippageGuessing,
  ],
  () => {
    debouncedCompute()
  },
  { deep: true },
)

function fail(message: string) {
  error.value = message
  return null
}

const worker = new Worker()
worker.onmessage = ({ data }) => {
  if (data.type === 'XLSX') {
    uploading.value = Math.max(0, uploading.value - 1)
    return storeData(data.rows, data.fileName)
  } else if (data.type === 'COMPUTE') {
    finalETH.value = data.finalETH
    drawdown.value = data.drawdown
    worstDrawdown.value = data.worstDrawdown
    counters.value = data.counters
    logs.value = data.logs
    hashes.value = data.hashes
    signatures.value = data.signatures
    loading.value = false
  }
}
worker.onerror = ({ message }) => {
  error.value = message
}
</script>

<style scoped>
.settingInput {
  min-width: 10rem;
}
.settingInputSmall {
  min-width: 7rem;
}
.flex-50 {
  flex: 1 1 50%;
}

.target-parent {
  position: relative;
}
.target-icon {
  opacity: 1;
}
.target-remove {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  height: 4rem;
}
.target-parent:hover .target-icon,
.target-parent:focus .target-icon,
.target-parent:active .target-icon {
  opacity: 0;
}
.target-parent:hover .target-remove,
.target-parent:focus .target-remove,
.target-parent:active .target-remove {
  opacity: 1;
}
</style>
