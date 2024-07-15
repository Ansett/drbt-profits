<template>
  <section class="relative">
    <ProgressSpinner
      v-if="loading"
      class="absolute top-0 left-50"
      style="width: 99px; height: 99px; transform: translate(-50%, 50px); z-index: 2"
    />
    <DataTable :value="countByHourByXs.x100" dataKey="id" size="small" class="pt-4">
      <Column field="title" header="ATH delay for x100+ calls" />
      <Column field="count" header="Count" />
      <Column field="pct" header="Percentage">
        <template #body="{ data }"> {{ data.pct }}% </template>
      </Column>
    </DataTable>
    <DataTable :value="countByHourByXs.x50" dataKey="id" size="small" class="pt-4">
      <Column field="title" header="ATH delay for x50-100 calls" />
      <Column field="count" header="Count" />
      <Column field="pct" header="Percentage">
        <template #body="{ data }"> {{ data.pct }}% </template>
      </Column>
    </DataTable>
    <DataTable :value="countByHourByXs.x50" dataKey="id" size="small" class="pt-4">
      <Column field="title" header="ATH delay for x10-50 calls" />
      <Column field="count" header="Count" />
      <Column field="pct" header="Percentage">
        <template #body="{ data }"> {{ data.pct }}% </template>
      </Column>
    </DataTable>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import ProgressSpinner from 'primevue/progressspinner'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import type { Call } from '@/types/Call'
import { round } from '@/lib'

type HourCategory = { id: number; title: string; count: number; pct: number }

const hoursCategories: HourCategory[] = [
  { id: 1, title: '0-1 hour', count: 0, pct: 0 }, // 0
  { id: 2, title: '1-2 hours', count: 0, pct: 0 }, // 1
  { id: 3, title: '2-3 hours', count: 0, pct: 0 }, // 2
  { id: 6, title: '3-6 hours', count: 0, pct: 0 }, // 3
  { id: 12, title: '6-12 hours', count: 0, pct: 0 }, // 4
  { id: 24, title: '12-24 hours', count: 0, pct: 0 }, // 5
  { id: 48, title: '1-2 days', count: 0, pct: 0 }, // 6
  { id: 72, title: '2-3 days', count: 0, pct: 0 }, // 7
  { id: 168, title: '3-7 days', count: 0, pct: 0 }, // 8
  { id: 336, title: '1-2 weeks', count: 0, pct: 0 }, // 9
  { id: 672, title: '2-4 weeks', count: 0, pct: 0 }, // 10
  { id: 999, title: '4+ weeks', count: 0, pct: 0 }, // 11
]
const getCategoryIndex = (hour: number): number => {
  const index = hoursCategories.findIndex(cat => hour < cat.id)
  return index > -1 ? index : hoursCategories.length - 1
}

// eslint-disable-next-line unused-imports/no-unused-vars-ts
const props = defineProps<{
  calls: Call[]
}>()

const loading = ref(false)
const countByHourByXs = ref<Record<'x10' | 'x50' | 'x100', HourCategory[]>>({
  x10: structuredClone(hoursCategories),
  x50: structuredClone(hoursCategories),
  x100: structuredClone(hoursCategories),
})

const compute = () => {
  loading.value = true

  const filteredCalls = props.calls.filter(call => !call.rug && call.xs >= 10)
  const totalX100 = filteredCalls.filter(call => call.xs >= 100).length
  const totalX50 = filteredCalls.filter(call => call.xs >= 50 && call.xs < 100).length
  const totalX10 = filteredCalls.filter(call => call.xs >= 10 && call.xs < 50).length

  for (const call of filteredCalls) {
    const xindex = call.xs >= 100 ? 'x100' : call.xs >= 50 ? 'x50' : 'x10'
    const total = call.xs >= 100 ? totalX100 : call.xs >= 50 ? totalX50 : totalX10
    const hour = Math.ceil(call.athDelayHours)
    const category = countByHourByXs.value[xindex][getCategoryIndex(hour)]
    category.count = (category.count || 0) + 1
    category.pct = round((category.count / total) * 100, 1)
  }

  loading.value = false
}
onMounted(() => compute())
watch(
  () => props.calls,
  () => compute(),
)
</script>
