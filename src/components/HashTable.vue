<template>
  <div class="relative">
    <DataTable
      ref="table"
      :value="lines"
      dataKey="id"
      :multiSortMeta="[{ field: 'allCalls.length', order: -1 }]"
      sortMode="multiple"
      size="small"
      :globalFilterFields="search"
      v-model:filters="filters"
      v-model:selection="selection"
      :paginator="lines.length > 20"
      :rows="20"
      paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
      :rowsPerPageOptions="[20, 50, 100]"
      @value-change="onDataChange"
    >
      <template #empty>
        No hash or signature available (check input for minimum calls limit)
      </template>
      <template #header v-if="lines.length">
        <div class="flex flex-wrap justify-content-end gap-3">
          <SplitButton label="Export" size="small" @click="exporting" :model="exportOptions" />
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
            <InputText
              v-model="filters.global.value"
              placeholder="ID, tag, CA or name search"
              class="narrowInput"
            />
            <Button
              icon="pi pi-times"
              outlined
              class="narrowInput text-color-secondary"
              @click="filters.global.value = null"
            />
          </InputGroup>
          <InfoButton
            :text="`<code>ctrl/command</click> click on column headers to multi-sort`"
            direction="bottom"
            class="align-self-center mr-2"
          />
        </div>
      </template>

      <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>
      <Column field="id" header="ID" :pt="{ headerTitle: { class: 'text-sm' } }"></Column>
      <!-- Calls count -->
      <Column
        v-if="selectedColumns.includes('Count')"
        field="allCalls.length"
        header="Nb calls"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      >
        <template #body="{ data }">
          <span class="link" @click="inspectedHash = data">
            {{ data.allCalls.length }}
          </span>
        </template>
      </Column>
      <!-- Average -->
      <Column
        v-if="selectedColumns.includes('Average')"
        :field="d => '' + Math.round(d.xSum / d.allCalls.length)"
        header="Xs average"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      >
        <template #body="{ data }">
          {{ Math.round(data.xSum / data.allCalls.length) }}
        </template>
      </Column>
      <!-- Xs -->
      <Column
        v-for="cat in shownPerf"
        :key="cat"
        :field="d => getSortablePct(d.perf[cat] / d.allCalls.length)"
        :header="cat"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      >
        <template #body="{ data }">
          {{ round((data.perf[cat] / data.allCalls.length) * 100, 1) + '%' }}
          <span class="text-sm text-color-secondary nowrap">
            (&hairsp;{{ data.perf[cat] }}&hairsp;)
          </span>
        </template>
      </Column>
      <!-- ATH -->
      <Column
        v-if="selectedColumns.includes('ATH')"
        key="ATH"
        field="mooners"
        header=">1m"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      />
      <!-- ATH 2 -->
      <Column
        v-if="selectedColumns.includes('ATH2')"
        key="ATH2"
        field="mooners2"
        header=">2m"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      />
      <!-- Rug -->
      <Column
        v-if="selectedColumns.includes('Rug')"
        :field="d => getSortablePct(d.rugs / d.allCalls.length)"
        header="Rugs"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      >
        <template #body="{ data }">
          {{ data.rugs }}
          <span class="text-sm text-color-secondary nowrap">
            (&hairsp;{{ Math.round((data.rugs / data.allCalls.length) * 100) + '%' }}&hairsp;)
          </span>
        </template>
      </Column>
      <!-- Tags -->
      <Column
        v-if="selectedColumns.includes('Tags')"
        :field="d => (d.tags ? d.tags.join(', ') : '')"
        header="Tags"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      >
        <template #body="{ data }">
          <i
            class="link pi pi-plus-circle"
            style="font-size: 0.8rem"
            v-tooltip.bottom="{
              value: 'Add a tag',
              showDelay: 500,
            }"
            @click="showTagInput(data.id, $event)"
          ></i>
          <span v-for="(tag, index) in data.tags" :key="index"
            >{{ index ? ', ' : ' '
            }}<span class="link" @click="removeTag(data.id, index)">{{ tag }}</span></span
          >
        </template>
      </Column>
    </DataTable>

    <!-- Hash calls popup -->
    <Sidebar
      ref="sidebar"
      :visible="!!inspectedHash"
      position="right"
      :modal="false"
      :header="`Calls with hash or sig ${inspectedHash?.id}`"
      :dismissable="false"
      :pt="{
        root: {
          class: 'w-screen md:w-auto',
        },
      }"
      @update:visible="inspectedHash = null"
      @hide="inspectedHash = null"
    >
      <DataTable
        v-if="inspectedHash"
        :value="inspectedHash.allCalls"
        dataKey="ca"
        size="small"
        :multiSortMeta="[{ field: 'date', order: -1 }]"
        sortMode="single"
        :paginator="inspectedHash.allCalls.length > 50"
        :rows="50"
        scrollable
        scrollHeight="calc(100vh - 165px)"
        :pt="{
          wrapper: {
            style: 'overscroll-behavior: none',
          },
        }"
      >
        <Column sortable field="date" header="Date">
          <template #body="{ data }">
            <span class="flex flex-wrap column-gap-2">
              <span class="nowrap">{{ prettifyDate(data.date, 'date') }}</span>
              <span class="nowrap text-color-secondary">{{ prettifyDate(data.date, 'hour') }}</span>
            </span>
          </template>
        </Column>
        <Column sortable field="name" header="CA">
          <template #body="{ data }">
            <CaLink :name="data.name" :ca="data.ca" :screener-url="screenerUrl" />
          </template>
        </Column>
        <Column sortable :field="d => (d.rug ? -1 : d.xs)" header="Perf">
          <template #body="{ data }">
            <Tag v-if="data.rug || data.xs === -99" value="rug" severity="warning" />
            <span v-else>{{ round(data.xs, 1) }}x</span>
          </template>
        </Column>
        <Column field="ath" header="ATH" sortable>
          <template #body="{ data }">
            <span
              :class="['help', { 'text-color-secondary font-italic': data.rug || data.xs === -99 }]"
              >{{ prettifyMc(data.ath) }}</span
            >
          </template>
        </Column>
      </DataTable>
    </Sidebar>

    <!-- Tag input -->
    <OverlayPanel ref="tagDropdown">
      <InputGroup>
        <InputGroupAddon>
          <i class="pi pi-tags"></i>
        </InputGroupAddon>
        <InputText ref="tagInput" type="text" v-model="newTag" @keyup.enter.native="addTag()" />
        <InputGroupAddon>
          <i class="pi pi-reply rotated"></i>
        </InputGroupAddon>
      </InputGroup>
    </OverlayPanel>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { HashInfo } from '../types/HashInfo'
import Sidebar from 'primevue/sidebar'
import OverlayPanel from 'primevue/overlaypanel'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import InputText from 'primevue/inputtext'
import vTooltip from 'primevue/tooltip'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import SplitButton from 'primevue/splitbutton'
import MultiSelect from 'primevue/multiselect'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { FilterMatchMode } from 'primevue/api'
import { prettifyDate, prettifyMc, round } from '../lib'
import CaLink from './CaLink.vue'
import InfoButton from './InfoButton.vue'
import { Call, SolCall } from '@/types/Call'

const TAG_SEPARATOR = ', '

const { lines, filterTemplate, screenerUrl } = defineProps<{
  lines: HashInfo<Call | SolCall>[]
  filterTemplate: string
  screenerUrl: string
}>()
const emit = defineEmits<{
  (e: 'removeTag', hash: string, index: number): void
  (e: 'addTag', hash: string, tag: string): void
}>()

const inspectedHash = ref<HashInfo | null>(null)
const tagDropdown = ref<InstanceType<typeof OverlayPanel>>()
const tagInput = ref()
const newTag = ref('')
const editingForHash = ref('')
const filters = ref({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
})

// prettier-ignore
const optionalColumns = ["Count","Average","x5","x10","x50","x100","ATH","ATH2","Rug","Tags"];
const selectedColumns = defineModel<string[]>('selectedColumns', {
  required: true,
})

const perfCats = ['x5', 'x10', 'x50', 'x100']
const shownPerf = computed(() => perfCats.filter(cat => selectedColumns.value.includes(cat)))

const removeTag = (hash: string, index: number) => emit('removeTag', hash, index)
const showTagInput = async (hash: string, event: MouseEvent) => {
  editingForHash.value = hash
  newTag.value = ''
  tagDropdown.value?.show(event)
  await nextTick()
  tagInput.value?.$el.focus()
}
const addTag = () => {
  tagDropdown.value?.hide()
  if (!editingForHash.value) return
  emit('addTag', editingForHash.value, newTag.value.trim().replace(TAG_SEPARATOR.trim(), ''))
  newTag.value = ''
  editingForHash.value = ''
}

const getSortablePct = (num: number) => ('' + num * 1000).padStart(4, '0')

let currentData: HashInfo[] = []
// when sorting or searching
const onDataChange = (data: HashInfo[]) => {
  currentData = data
}
const selection = ref<HashInfo[]>([])
// when checking rows
const getSelection = () => (selection.value.length ? selection.value : currentData)

const table = ref<InstanceType<typeof DataTable>>()
const toast = useToast()
const getIdsString = () =>
  filterTemplate.includes('[{}]')
    ? getSelection()
        .map(d => d.id)
        .join(',')
    : getSelection()
        .map(d => d.id)
        .join('|')

const getQueryFilter = () => filterTemplate.replace('{}', getIdsString())

const exportOptions = [
  {
    label: 'Copy IDs',
    icon: 'pi pi-list',
    command: () => {
      const list = getIdsString()
      navigator.clipboard.writeText(list)
      toast.add({
        severity: 'success',
        summary: 'Copied list of IDs to clipboard',
        detail: list.length > 100 ? list.substring(0, 100) + '...' : list,
        life: 5000,
      })
    },
  },
  {
    label: 'Copy filter',
    icon: 'pi pi-filter',
    command: () => {
      const list = getQueryFilter()
      navigator.clipboard.writeText(list)
      toast.add({
        severity: 'success',
        summary: 'Copied filter to clipboard',
        detail: list.length > 100 ? list.substring(0, 100) + '...' : list,
        life: 5000,
      })
    },
  },
  {
    label: 'Export CSV',
    icon: 'pi pi-file-export',
    command: () => {
      table.value?.exportCSV()
    },
  },
]

const search = [
  'id',
  'tags',
  (data: HashInfo) => data.allCalls.map(c => c.name).join(' '), // search by call name
  (data: HashInfo) => data.allCalls.map(c => c.ca).join(' '), // search by call CA
] as unknown as string[]

const exporting = () => exportOptions[0].command()

const sidebar = ref<InstanceType<typeof Sidebar>>()
const onKeyDown = (event: KeyboardEvent) => {
  if (event.code === 'Escape') {
    inspectedHash.value = null
  }
}
window.document.addEventListener('keydown', onKeyDown)
onBeforeUnmount(() => {
  window.document.removeEventListener('keydown', onKeyDown)
})

onMounted(() => {})
</script>

<style scoped>
.rotated {
  transform: rotate(-0.5turn);
}
</style>
