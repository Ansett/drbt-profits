<template>
  <section>
    <Button
      v-if="withDisplaySwitch"
      :icon="'pi ' + (textual ? 'pi-list' : 'pi-table')"
      size="small"
      text
      tabindex="-1"
      severity="secondary"
      class="accordion-button"
      v-tooltip.left="{
        value: textual ? 'Switch to table view' : 'Switch to text view',
        showDelay: 500,
      }"
      @click.stop="textual = !textual"
    />

    <template v-if="textual">
      <ul class="p-3 m-0">
        <li v-if="!filteredLogs.length">No calls</li>
        <li
          v-else
          v-for="log in filteredLogs.slice(logsPage, logsPage + logsRowCount)"
          :key="log.ca"
          class="text-sm mb-3"
        >
          <span class=""
            >[{{
              formatDate(log.date, timezone)[0] + ', ' + formatDate(log.date, timezone)[1]
            }}]</span
          ><br /><span class="text-color-secondary"> bought </span
          ><span class="font-bold">{{ log.invested }}</span>
          <span class="text-color-secondary"> of </span>
          <CaLink :name="log.name + ''" :ca="log.ca" :screener-url="screenerUrl" />
          <br />
          <span class="text-color-secondary"> did </span>
          <span v-if="log.xs === -99" class="text-orange-400">RUG</span>
          <template v-else>
            <span class="font-bold">{{ log.xs > 10 ? Math.round(log.xs) : log.xs }}x</span>
            <span class="text-color-secondary"> to </span>
            <span class="font-bold">{{ prettifyMc(log.ath) }}</span>
          </template>
          <span v-if="log.info" class="font-bold"> (&hairsp;{{ log.info }}&hairsp;)</span>
          <span class="text-color-secondary"> resulting in </span>
          <span
            :class="['font-bold', log.gain > 0 ? 'text-cyan-300 underline' : 'text-purple-600	']"
            >{{ (log.gain > 0 ? '+' : '') + log.gain }}</span
          >
          <span class="text-color-secondary"> {{ chain === 'SOL' ? 'SOL' : 'ETH' }}</span>
          <span v-if="log.hitTp.length">
            (
            {{ log.hitTp.join(' & ') + ' hit' }}
            )
          </span>
        </li>
      </ul>
      <Paginator
        v-if="filteredLogs.length"
        v-model:first="logsPage"
        v-model:rows="logsRowCount"
        :totalRecords="filteredLogs.length"
        template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
        :rowsPerPageOptions="[10, 25, 100]"
      />
    </template>

    <DataTable
      v-else
      ref="logTable"
      :value="sortedLogs"
      dataKey="ca"
      size="small"
      :multiSortMeta="multiSortMeta"
      sortMode="multiple"
      :paginator="sortedLogs.length > 20"
      :rows="rows || 25"
      paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
      :rowsPerPageOptions="[10, 25, 100]"
      :globalFilterFields="['ca', 'name', 'date', 'flag']"
      v-model:filters="logFilters"
      @value-change="onListUpdate"
      @sort="onSort"
    >
      <template #empty> No calls </template>

      <template #header>
        <div class="flex flex-wrap justify-content-end gap-3">
          <slot name="header" />

          <InputGroup
            class="w-auto small-button"
            v-tooltip.top="{
              value: profitableFilter ? 'Show all trades' : 'Show only profitable trades',
              showDelay: 500,
            }"
          >
            <InputGroupAddon class="narrowInput">
              <span
                class="material-symbols-outlined cursor-pointer"
                @click="profitableFilter = !profitableFilter"
                >trophy</span
              >
            </InputGroupAddon>
            <InputGroupAddon>
              <Checkbox v-model="profitableFilter" binary v-bind="{ 'aria-label': 'Filter' }" />
            </InputGroupAddon>
          </InputGroup>
          <Button
            icon="pi pi-file-export"
            aria-label="Export CSV"
            outlined
            severity="secondary"
            v-tooltip.top="{
              value: 'Export displayed logs CSV',
              showDelay: 500,
            }"
            class="small-button"
            @click="exportLogs()"
          />
          <Button
            icon="pi pi-file-excel"
            aria-label="Export XLSX"
            outlined
            severity="secondary"
            v-tooltip.top="{
              value: 'Export displayed calls XLSX',
              showDelay: 500,
            }"
            class="small-button"
            @click="exportSourceCalls()"
          />
          <InputGroup class="w-auto">
            <InputGroupAddon class="narrowInput">
              <i class="pi pi-sliders-v"></i>
            </InputGroupAddon>
            <MultiSelect
              v-model="selectedColumns"
              :options="optionalColumns"
              placeholder="Columns"
              selectedItemsLabel="{0} cols"
              :maxSelectedLabels="0"
              scrollHeight="300px"
              class="narrowInput"
              :pt="{
                root: { class: 'narrowInput' },
                label: { class: 'narrowInput' },
                item: { class: 'pr-5' },
              }"
            />
          </InputGroup>
          <InputGroup class="w-auto">
            <InputGroupAddon class="narrowInput">
              <i class="pi pi-search"></i>
            </InputGroupAddon>
            <InputText v-model="logFilters.global.value" placeholder="Search" class="narrowInput" />
            <Button
              icon="pi pi-times"
              outlined
              class="narrowInput text-color-secondary"
              @click="logFilters.global.value = null"
            />
          </InputGroup>
          <InfoButton
            :text="`<code>ctrl/command</click> click on column headers to multi-sort`"
            direction="bottom"
            class="align-self-center mr-2"
          /></div
      ></template>

      <Column field="date" header="Date" sortable :pt="{ headerTitle: { class: 'text-xs' } }">
        <template #body="{ data }">
          <span
            class="flex flex-wrap column-gap-2"
            v-tooltip.right="{
              value: `${chain === 'SOL' ? 'Created' : 'Launched'} at ${formatDate(
                data.creation,
                timezone,
              ).join(' ')}`,
              showDelay: 500,
            }"
          >
            <span class="nowrap">{{ formatDate(data.date, timezone)[0] }}</span>
            <span class="nowrap text-color-secondary">{{
              formatDate(data.date, timezone)[1]
            }}</span>
          </span>
        </template>
      </Column>
      <Column
        :field="d => d.name + ' ' + d.ca"
        header="CA"
        sortable
        :pt="{ headerTitle: { class: 'text-xs' } }"
      >
        <template #body="{ data }">
          <CaLink :name="data.name" :ca="data.ca" :screener-url="screenerUrl" />
        </template>
      </Column>
      <Column
        v-if="selectedColumns.includes('Block')"
        field="theoricBlock"
        header="Block"
        sortable
        :pt="{ headerTitle: { class: 'text-xs' } }"
      >
        <template #body="{ data }">
          <div class="flex flex-row flex-wrap">
            <span class="nowrap text-color-secondary"
              >(+{{ data.theoricBlock - data.callBlock }})
            </span>
            <a :href="blockExplorer + data.theoricBlock" target="_blank">{{ data.theoricBlock }}</a>
          </div>
        </template>
      </Column>
      <Column
        v-if="selectedColumns.includes('Invested')"
        field="invested"
        header="Invested"
        sortable
        :pt="{ headerTitle: { class: 'text-xs' } }"
      >
        <template #body="{ data }">
          <Tag v-if="data.flag === 'off'" :value="data.flag" severity="secondary" />
          <span v-else>{{ data.invested }}</span>
        </template>
      </Column>
      <Column
        v-if="selectedColumns.includes('Gas price')"
        field="gasPrice"
        header="Gas price"
        sortable
        :pt="{ headerTitle: { class: 'text-xs' } }"
      >
        <template #body="{ data }">
          {{ data.gasPrice }}
        </template>
      </Column>
      <Column
        v-if="selectedColumns.includes('Buy tax')"
        field="buyTax"
        header="Tax"
        sortable
        :pt="{ headerTitle: { class: 'text-xs' } }"
      >
        <template #body="{ data }"> {{ data.buyTax }}% </template>
      </Column>
      <Column
        v-if="selectedColumns.includes('Entry MC')"
        field="callMc"
        header="MC"
        sortable
        :pt="{ headerTitle: { class: 'text-xs' } }"
      >
        <template #body="{ data }">
          <span class="flex flex-wrap column-gap-2 align-items-center">
            <span>{{ prettifyMc(data.entryMc * (1 + data.slippage / 100)) }}</span>
            <span
              class="text-sm text-color-secondary nowrap help"
              v-tooltip.top="{
                value: 'Call MC (no delay/slippage)',
                showDelay: 500,
              }"
            >
              (&hairsp;{{ prettifyMc(data.callMc) }}&hairsp;)
            </span>
          </span>
        </template>
      </Column>
      <Column
        v-if="selectedColumns.includes('ATH MC')"
        field="ath"
        header="ATH"
        sortable
        :pt="{ headerTitle: { class: 'text-xs' } }"
      >
        <template #body="{ data }">
          <span
            :class="{
              'text-color-secondary font-italic': data.xs === -99,
            }"
            >{{ prettifyMc(data.ath) }}</span
          >
          <span
            v-if="data.ath - data.exportAth"
            class="text-sm text-color-secondary nowrap help"
            v-tooltip.top="{
              value: athTooltip(data),
              showDelay: 500,
            }"
          >
            (&hairsp;{{ prettifyMc(data.exportAth) }}&hairsp;)
          </span>
        </template></Column
      >

      <Column header="Perf" field="xs" sortable :pt="{ headerTitle: { class: 'text-xs' } }">
        <template #header>
          <InfoButton
            text="Accounting for slippage"
            direction="top"
            hover
            style="margin-top: 2px; margin-right: 6px"
        /></template>
        <template #body="{ data }">
          <Tag v-if="data.xs === -99" value="rug" severity="warning" />
          <span v-else class="nowrap"
            >{{ data.xs }}x
            <InfoButton v-if="data.info" :text="data.info" direction="top" class="inlineIcon" />
          </span>
        </template>
      </Column>

      <Column
        v-if="selectedColumns.includes('Perf diff')"
        header="Diff"
        field="xsDiff"
        sortable
        :pt="{ headerTitle: { class: 'text-xs' } }"
      >
        <template #header
          ><InfoButton
            text="Difference between Xs between this simulation and Xs from exported backtest XLSX"
            direction="top"
            hover
            style="margin-top: 2px; margin-right: 6px"
        /></template>
        <template #body="{ data }">
          <span class="flex flex-wrap column-gap-2 align-items-center">
            <span
              class="help"
              v-tooltip.top="{
                value: `Export: ${data.xs - data.xsDiff}x -> Simulation: ${data.xs}x`,
                showDelay: 500,
              }"
              >{{ data.xsDiff === null ? '-' : data.xsDiff }}</span
            >
          </span>
        </template>
      </Column>

      <Column field="gain" header="Gain" sortable :pt="{ headerTitle: { class: 'text-xs' } }">
        <template #body="{ data }">
          <span class="flex column-gap-2 align-items-center">
            <span
              v-if="data.gain > 0"
              :class="[
                'text-cyan-300',
                data.ignored ? 'font-italic' : 'font-bold',
                { 'line-through': data.flag === 'off' },
              ]"
              >{{ '+' + data.gain }}</span
            >
            <span :class="{ 'line-through': data.flag === 'off' }" v-else>{{ data.gain }}</span>

            <Tag v-if="data.flag" :value="data.flag" severity="secondary" />
            <span
              v-else-if="data.hitTp.length"
              class="text-sm text-color-secondary nowrap help"
              v-tooltip.top="{
                value: data.hitTp.join(' & '),
                showDelay: 500,
              }"
            >
              (&hairsp;{{ data.hitTp.length }}&hairsp;)
            </span>
          </span>
        </template>
      </Column>
      <Column v-if="withActions">
        <template #body="{ data }">
          <MenuButton :ref="data.ca" :actions="getActions(data)" />
        </template>
      </Column>
    </DataTable>

    <Dialog
      v-model:visible="athDialog.visible"
      modal
      header="Correcting the ATH"
      :style="{ width: '24rem' }"
      @show="onAthDialogShow"
    >
      <form @submit.prevent="saveAthMc">
        <p class="mt-0 mb-3 text-sm text-color-secondary">
          <CaLink
            :name="athDialog.name"
            :ca="athDialog.ca"
            :screener-url="screenerUrl"
            class="mt-2"
          />
        </p>
        <label for="ath-mc-fetched" class="block mb-2">
          Fetched ATH
          <span v-if="athLookupSourceLabel" class="font-normal text-color-secondary">
            · {{ athLookupSourceLabel }}
          </span>
        </label>
        <InputGroup class="w-full">
          <InputNumber
            v-model="athLookup.value"
            inputId="ath-mc-fetched"
            :min="0"
            :maxFractionDigits="0"
            class="w-full"
            readonly
            :placeholder="athLookupPlaceholder"
          />
          <Button
            icon="pi pi-arrow-down"
            outlined
            :loading="athLookupLoading"
            :disabled="!athLookupLoading && athLookup.value == null"
            aria-label="Copy fetched ATH"
            v-tooltip.top="{
              value: 'Copy fetched ATH into the field below',
              showDelay: 400,
            }"
            @click="applyLookedUpAth"
          />
        </InputGroup>
        <p v-if="athLookup.error" class="mt-2 mb-0 text-sm text-red-400">
          {{ athLookup.error }}
          <Button label="Retry" text size="small" class="p-0 ml-1" @click="lookupAthMc" />
        </p>
        <label for="ath-mc-input" class="block mb-2 mt-3">ATH market cap (USD)</label>
        <InputGroup class="w-full">
          <InputNumber
            v-model="athDialog.value"
            inputId="ath-mc-input"
            :min="0"
            :step="10000"
            :maxFractionDigits="0"
            class="w-full"
            :inputProps="{ autofocus: true }"
          />
          <Button
            icon="pi pi-times"
            outlined
            class="text-color-secondary"
            :disabled="athDialog.value == null"
            aria-label="Clear"
            @click="athDialog.value = null"
          />
        </InputGroup>
        <p class="mt-2 mb-0 text-sm text-color-secondary">
          Saving again updates your value. Clear and save to remove it. Simulations use the average
          across users.
        </p>
        <button type="submit" class="hidden" tabindex="-1">Save</button>
      </form>
      <template #footer>
        <Button label="Cancel" text severity="secondary" @click="athDialog.visible = false" />
        <Button label="Save" @click="saveAthMc" />
      </template>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, reactive, nextTick } from 'vue'
import type { ChainId } from '@/types/Call'
import type { Log } from '@/types/Log'
import { prettifyMc } from '@/lib'
import { addAthMc, athSampleCount, getMyAthMc, hasAthOverride } from '@/ath-mc'
import { FilterMatchMode } from 'primevue/api'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import DataTable, { type DataTableSortMeta, type DataTableSortEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import Paginator from 'primevue/paginator'
import MultiSelect from 'primevue/multiselect'
import { useToast } from 'primevue/usetoast'
import vTooltip from 'primevue/tooltip'
import InfoButton from './InfoButton.vue'
import CaLink from './CaLink.vue'
import MenuButton from './MenuButton.vue'
import { RH_BLOCK_EXPLORER_URL, SOL_BLOCK_EXPLORER_URL, ETH_BLOCK_EXPLORER_URL } from '../constants'
import { useTimezone } from '@/compose/useTimezone'

const {
  logs,
  rows,
  initialSort,
  withDisplaySwitch,
  withActions,
  screenerUrl,
  chain = 'ETH',
  timezone = 'UTC',
} = defineProps<{
  logs: Log[]
  rows?: number
  initialSort?: string
  withDisplaySwitch?: boolean
  withActions?: boolean
  screenerUrl: string
  chain?: ChainId
  timezone?: string
}>()

const emit = defineEmits<{
  (e: 'ignore', ca: string, state: boolean): void
  (e: 'rug', ca: string, state: boolean): void
  (e: 'athMc', ca: string, ath: number | null): void
  (e: 'exportXlsx', logs: Log[]): void
}>()

const toast = useToast()
const athLookupLoading = ref(false)
let athLookupSeq = 0
const athLookup = reactive({
  value: null as number | null,
  source: '' as '' | 'gmgn' | 'geckoterminal',
  error: '',
})
const athDialog = reactive({
  visible: false,
  ca: '',
  name: '',
  value: null as number | null,
})

const athLookupSourceLabel = computed(() => {
  if (athLookup.source === 'gmgn') return 'GMGN'
  if (athLookup.source === 'geckoterminal') return 'GeckoTerminal'
  return ''
})
const athLookupPlaceholder = computed(() => {
  if (athLookupLoading.value) return 'Fetching…'
  if (athLookup.error) return 'Unavailable'
  return ''
})

function athTooltip(log: Log) {
  const n = athSampleCount(log.ca)
  if (!n) return ''

  return `Original ATH before correction from ${n} user${n === 1 ? '' : 's'}`
}

function resetAthLookup() {
  athLookupSeq += 1
  athLookupLoading.value = false
  athLookup.value = null
  athLookup.source = ''
  athLookup.error = ''
}

function openAthDialog(log: Log) {
  resetAthLookup()
  athDialog.ca = log.ca
  athDialog.name = log.name
  athDialog.value = getMyAthMc(log.ca) ?? log.ath
  athDialog.visible = true
  lookupAthMc()
}

function onAthDialogShow() {
  nextTick(() => {
    const input = document.getElementById('ath-mc-input') as HTMLInputElement | null
    input?.focus()
    input?.select()
  })
}

function applyLookedUpAth() {
  if (athLookup.value == null) return
  athDialog.value = athLookup.value
  nextTick(() => {
    const input = document.getElementById('ath-mc-input') as HTMLInputElement | null
    input?.focus()
    input?.select()
  })
}

async function lookupAthMc() {
  if (!athDialog.ca) return
  const seq = ++athLookupSeq
  athLookupLoading.value = true
  athLookup.value = null
  athLookup.source = ''
  athLookup.error = ''
  try {
    const res = await fetch(
      `/api/ath-mc/lookup?chain=${encodeURIComponent(chain)}&ca=${encodeURIComponent(athDialog.ca)}`,
    )
    const body = await res.json().catch(() => ({}))
    if (seq !== athLookupSeq) return
    if (!res.ok) throw new Error(body.error || `Lookup failed (${res.status})`)
    const athMc = Number(body.ath)
    if (!(athMc > 0)) throw new Error('Lookup returned no ATH')
    athLookup.value = Math.round(athMc)
    athLookup.source = body.source === 'gmgn' ? 'gmgn' : 'geckoterminal'
  } catch (error) {
    if (seq !== athLookupSeq) return
    athLookup.error = error instanceof Error ? error.message : String(error)
  } finally {
    if (seq === athLookupSeq) athLookupLoading.value = false
  }
}

async function saveAthMc() {
  if (!athDialog.visible || !athDialog.ca) return
  const raw = athDialog.value
  const cleared = raw == null
  const value = cleared ? null : Number(raw)
  if (!cleared && (!Number.isFinite(value) || (value as number) <= 0)) return

  athDialog.visible = false
  const { ath, persisted, replaced, removed } = await addAthMc(athDialog.ca, value)
  emit('athMc', athDialog.ca, ath)
  const users = athSampleCount(athDialog.ca)
  const userLabel = users === 1 ? '1 user' : `${users} users`
  let summary = 'ATH saved'
  if (!persisted) summary = 'ATH applied this session'
  else if (removed) summary = 'ATH cleared'
  else if (replaced) summary = 'ATH updated'
  let detail = "Could not save ATH data. It won't persist."
  if (persisted) {
    if (ath == null) detail = 'Using ATH from the export'
    else detail = `Using ${prettifyMc(ath)} (average of ${userLabel})`
  }
  toast.add({
    severity: persisted ? 'success' : 'warn',
    summary,
    detail,
    life: persisted ? 4000 : 10000,
  })
}

const textual = defineModel<boolean>('textual', {
  default: false,
})
const logsPage = ref(0)
const logsRowCount = ref(25)

const profitableFilter = ref(false)
const filteredLogs = computed(() => (profitableFilter.value ? logs.filter(l => l.gain > 0) : logs))

const noBlock = computed(() => chain === 'SOL')
const noGas = computed(() => chain !== 'ETH')
const noTaxes = computed(() => chain === 'SOL')
const canRug = computed(() => chain === 'ETH')
const blockExplorer = computed(() =>
  chain === 'RH'
    ? RH_BLOCK_EXPLORER_URL
    : chain === 'SOL'
      ? SOL_BLOCK_EXPLORER_URL
      : ETH_BLOCK_EXPLORER_URL,
)

const { formatDate } = useTimezone()

// prettier-ignore
const optionalColumns = [!noBlock.value && "Block", "Invested", !noGas.value && "Gas price", !noTaxes.value && "Buy tax", "Entry MC", "ATH MC", "Perf diff"].filter(Boolean);
const selectedColumns = defineModel<string[]>('selectedColumns', {
  required: true,
})

const logTable = ref<InstanceType<typeof DataTable>>()
const exportLogs = () => logTable.value?.exportCSV()

const logFilters = ref({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
})

const multiSortMeta = ref<DataTableSortMeta[] | undefined>([
  { field: initialSort || 'date', order: -1 },
])
function onSort(event: DataTableSortEvent) {
  multiSortMeta.value = event.multiSortMeta
}
const sortedLogs = computed<Log[]>(() => {
  if (!multiSortMeta.value?.length) return filteredLogs.value

  return filteredLogs.value.slice().sort((a, b) => {
    for (const meta of multiSortMeta.value || []) {
      const field = meta.field as keyof Log
      const order = meta.order || 1

      const valA = a[field]
      const valB = b[field]

      if (valA == null && valB == null) continue
      if (valA == null) return order * -1
      if (valB == null) return order * 1

      const result = valA > valB ? 1 : valA < valB ? -1 : 0
      if (result !== 0) return order * result
    }
    return 0
  })
})

const getActions = (log: Log) => [
  ...(canRug.value
    ? [
        log.xs === -99
          ? {
              label: 'Unset as rug',
              icon: 'pi pi-thumbs-up',
              command: () => {
                emit('rug', log.ca, false)
              },
            }
          : {
              label: 'Set as rug',
              icon: 'pi pi-thumbs-down',
              command: () => {
                emit('rug', log.ca, true)
              },
            },
      ]
    : []),
  {
    label: 'Correct ATH',
    icon: 'pi pi-chart-line',
    command: () => openAthDialog(log),
  },
  log.ignored
    ? {
        label: 'Do not ignore',
        icon: 'pi pi-eye',
        command: () => {
          emit('ignore', log.ca, false)
        },
      }
    : {
        label: 'Ignore',
        icon: 'pi pi-eye-slash',
        command: () => {
          emit('ignore', log.ca, true)
        },
      },
]

let currentlyShownLogs = [] as Log[]
const onListUpdate = (shownLogs: Log[]) => {
  currentlyShownLogs = shownLogs
}

const exportSourceCalls = () => {
  emit('exportXlsx', currentlyShownLogs)
}
</script>

<style scoped>
.accordion-button {
  position: absolute;
  right: 0.5rem;
  top: 0.5rem;
  z-index: 2;
}

td {
  overflow: hidden;
}
</style>
