<template>
  <section>
    <Button
      v-if="withDisplaySwitch"
      :icon="'pi ' + (textual ? 'pi-table' : 'pi-list')"
      size="small"
      text
      raised
      class="accordion-button"
      aria-label="Logs view"
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
          <span class="">[{{ log.date }}]</span><br /><span class="text-color-secondary">
            bought </span
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
          <span class="text-color-secondary"> ETH</span>
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
        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
        :rowsPerPageOptions="[10, 25, 100]"
      />
    </template>

    <DataTable
      v-else
      ref="logTable"
      :value="filteredLogs"
      dataKey="ca"
      size="small"
      :multiSortMeta="[{ field: initialSort || 'date', order: -1 }]"
      sortMode="multiple"
      :paginator="filteredLogs.length > 20"
      :rows="rows || 25"
      paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
      :rowsPerPageOptions="[10, 25, 100]"
      :globalFilterFields="['ca', 'name', 'date', 'flag']"
      v-model:filters="logFilters"
      @value-change="onListUpdate"
    >
      <template #empty> No calls </template>

      <template #header>
        <div class="flex flex-wrap justify-content-end gap-3">
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
              <Checkbox v-model="profitableFilter" binary aria-label="Filter" />
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
          <span class="flex flex-wrap column-gap-2">
            <span class="nowrap">{{ prettifyDate(data.date, 'date') }}</span>
            <span class="nowrap text-color-secondary">{{ prettifyDate(data.date, 'hour') }}</span>
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
            <a :href="'https://etherscan.io/block/' + data.theoricBlock" target="_blank">{{
              data.theoricBlock
            }}</a>
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
          {{ data.invested }}
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
            <span
              ><span
                v-if="!noSlippage && data.xs <= XS_WORTH_OF_ONCHAIN_DATA"
                class="text-color-secondary"
                >~</span
              >{{ prettifyMc(data.callMc * (1 + data.slippage / 100)) }}</span
            >
            <span
              v-if="!noSlippage && data.xs > XS_WORTH_OF_ONCHAIN_DATA"
              class="text-sm text-color-secondary nowrap help"
              v-tooltip.top="{
                value: 'Entry without slippage',
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
            :class="['help', { 'text-color-secondary font-italic': data.xs === -99 }]"
            v-tooltip.top="{
              value: data.ath + '',
              showDelay: 500,
            }"
            >{{ prettifyMc(data.ath) }}</span
          >
        </template></Column
      >

      <Column header="Perf" field="xs" sortable :pt="{ headerTitle: { class: 'text-xs' } }">
        <template #header
          ><InfoButton
            v-if="!noSlippage"
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
          <span v-if="data.gain <= 0" class="flex column-gap-2 align-items-center">
            <span>{{ data.gain }}</span>
            <Tag v-if="data.flag" :value="data.flag" severity="secondary" />
          </span>
          <span v-else class="flex column-gap-2 align-items-center">
            <span :class="['text-cyan-300', data.ignored ? 'font-italic' : 'font-bold']">{{
              '+' + data.gain
            }}</span>
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
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Log } from '@/types/Log'
import { prettifyDate, prettifyMc } from '@/lib'
import { FilterMatchMode } from 'primevue/api'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import InputText from 'primevue/inputtext'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Tag from 'primevue/tag'
import Paginator from 'primevue/paginator'
import MultiSelect from 'primevue/multiselect'
import vTooltip from 'primevue/tooltip'
import InfoButton from './InfoButton.vue'
import CaLink from './CaLink.vue'
import MenuButton from './MenuButton.vue'
import { XS_WORTH_OF_ONCHAIN_DATA } from '../constants'

// eslint-disable-next-line unused-imports/no-unused-vars-ts
const {
  logs,
  rows,
  initialSort,
  withDisplaySwitch,
  withActions,
  screenerUrl,
  chain = 'ETH',
} = defineProps<{
  logs: Log[]
  rows?: number
  initialSort?: string
  withDisplaySwitch?: boolean
  withActions?: boolean
  screenerUrl: string
  chain?: 'ETH' | 'SOL'
}>()

const emit = defineEmits<{
  (e: 'ignore', ca: string, state: boolean): void
  (e: 'rug', ca: string, state: boolean): void
  (e: 'exportXlsx', logs: Log[]): void
}>()

const textual = defineModel<boolean>('textual', {
  default: false,
})
const logsPage = ref(0)
const logsRowCount = ref(25)

const profitableFilter = ref(false)
const filteredLogs = computed(() => (profitableFilter.value ? logs.filter(l => l.gain > 0) : logs))

const noBlock = computed(() => chain === 'SOL')
const noGas = computed(() => chain === 'SOL')
const noTaxes = computed(() => chain === 'SOL')
const noSlippage = computed(() => chain === 'SOL')
const canRug = computed(() => chain === 'ETH')

// prettier-ignore
const optionalColumns = [!noBlock.value && "Block", "Invested", !noGas.value && "Gas price", !noTaxes.value && "Buy tax", "Entry MC", "ATH MC", !noSlippage.value && "Perf diff"].filter(Boolean);
const selectedColumns = defineModel<string[]>('selectedColumns', {
  required: true,
})

const logTable = ref<InstanceType<typeof DataTable>>()
const exportLogs = () => logTable.value?.exportCSV()

const logFilters = ref({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
})

const getActions = (log: Log) => [
  ...(canRug.value
    ? [
        log.xs === -99
          ? {
              label: 'Not rug',
              icon: 'pi pi-thumbs-up',
              command: () => {
                emit('rug', log.ca, false)
              },
            }
          : {
              label: 'Rug',
              icon: 'pi pi-thumbs-down',
              command: () => {
                emit('rug', log.ca, true)
              },
            },
      ]
    : []),
  log.ignored
    ? {
        label: 'Not ignored',
        icon: 'pi pi-eye',
        command: () => {
          emit('ignore', log.ca, false)
        },
      }
    : {
        label: 'Ignored',
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
