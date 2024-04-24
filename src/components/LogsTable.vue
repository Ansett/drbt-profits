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
          <CaLink :name="log.name + ''" :ca="log.ca" />
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
        :rowsPerPageOptions="[10, 20, 50, 100]"
      />
    </template>

    <DataTable
      v-else
      ref="logTable"
      :value="filteredLogs"
      dataKey="ca"
      size="small"
      :sortField="initialSort || 'date'"
      :sortOrder="-1"
      sortMode="single"
      :paginator="filteredLogs.length > 20"
      :rows="rows || 20"
      paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
      :rowsPerPageOptions="[10, 20, 50, 100]"
      :globalFilterFields="['ca', 'name', 'date']"
      v-model:filters="logFilters"
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
              value: 'Export CSV',
              showDelay: 500,
            }"
            class="small-button"
            @click="exportLogs()"
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
          </InputGroup></div
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
          <CaLink :name="data.name" :ca="data.ca" />
        </template>
      </Column>
      <Column
        v-if="selectedColumns.includes('Block')"
        field="block"
        header="block"
        sortable
        :pt="{ headerTitle: { class: 'text-xs' } }"
      >
        <template #body="{ data }">
          <a :href="'https://etherscan.io/block/' + data.block" target="_blank">{{ data.block }}</a>
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
        v-if="selectedColumns.includes('Entry MC')"
        field="callMc"
        header="MC"
        sortable
        :pt="{ headerTitle: { class: 'text-xs' } }"
      >
        <template #body="{ data }">
          <span class="flex flex-wrap column-gap-2 align-items-center">
            <span>
              {{ prettifyMc(data.callMc * (1 + data.slippage / 100)) }}
            </span>
            <span
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
      <Column field="gain" header="Gain" sortable :pt="{ headerTitle: { class: 'text-xs' } }">
        <template #body="{ data }">
          <span v-if="data.gain <= 0">{{ data.gain }}</span>
          <span v-else class="flex column-gap-2 align-items-center">
            <span class="font-bold text-cyan-300">{{ '+' + data.gain }}</span>
            <span
              v-if="data.hitTp.length"
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

// eslint-disable-next-line unused-imports/no-unused-vars-ts
const props = defineProps<{
  logs: Log[]
  rows?: number
  textual?: boolean
  initialSort?: string
  withDisplaySwitch?: boolean
}>()

const emit = defineEmits<{
  (e: 'whatever'): void
}>()

const textual = defineModel<boolean>('textual', {
  default: false,
})
const logsPage = ref(0)
const logsRowCount = ref(20)

const profitableFilter = ref(false)
const filteredLogs = computed(() =>
  profitableFilter.value ? props.logs.filter(l => l.gain > 0) : props.logs,
)

// prettier-ignore
const optionalColumns = ["Block", "Invested","Gas price","Entry MC","ATH MC"];
const selectedColumns = defineModel<string[]>('selectedColumns', {
  required: true,
})

const logTable = ref<InstanceType<typeof DataTable>>()
const exportLogs = () => logTable.value?.exportCSV()

const logFilters = ref({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
})
</script>

<style scoped>
.accordion-button {
  position: absolute;
  right: 0.5rem;
  top: 0.5rem;
  z-index: 2;
}
</style>
