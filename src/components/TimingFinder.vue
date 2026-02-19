<template>
  <section class="relative">
    <ProgressSpinner
      v-if="loading"
      class="absolute top-0 left-50"
      style="width: 99px; height: 99px; transform: translate(-50%, 50px); z-index: 2"
    />

    <div class="flex gap-4">
      <div class="flex gap-2 pt-1 pl-2 pt-4">
        <InputSwitch v-model="onlyWinners" inputId="only-winners" />
        <label for="only-winners" class="white-space-nowrap">Only winners</label>
      </div>
      <div class="flex gap-2 pt-1 pl-2 pt-4">
        <InputSwitch
          :modelValue="timeOnCreation"
          inputId="snapshot-time"
          @update:modelValue="$emit('update:timeOnCreation', $event)"
        />
        <label for="snapshot-time" class="white-space-nowrap">Use created_at</label>
        <InfoButton :text="`Use created_at instead of snapshot_at`" direction="bottom" />
      </div>
    </div>

    <DataTable :value="daysData" dataKey="id" size="small" class="pt-3">
      <Column field="dayName" header="Day (from 9am to next day 9am UTC)" />
      <Column field="count" header="Gain" style="width: 38%">
        <template #body="{ data }">
          <span
            :class="{
              'text-green-400': data.count > 0,
            }"
            >{{ round(data.count) }}</span
          >
        </template>
      </Column>
      <Column v-if="withTimeRange" field="allPeriods" header="All Periods">
        <template #body="{ data }">
          <span
            :class="
              data.allPeriods < data.count
                ? 'text-green-400'
                : data.allPeriods > data.count
                ? 'text-orange-300'
                : 'text-color-secondary'
            "
            >{{
              data.allPeriods < data.count ? '>' : data.allPeriods > data.count ? '<' : '='
            }}</span
          >
          <span class="text-color-secondary">&nbsp;{{ round(data.allPeriods) }}</span>
        </template>
      </Column>
    </DataTable>

    <DataTable
      :value="hoursData"
      dataKey="id"
      size="small"
      rowGroupMode="rowspan"
      groupRowsBy="dayName"
      class="mt-6"
    >
      <Column field="dayName" header="Day" />
      <Column field="sliceName" header="Hour (UTC)" />
      <Column field="count" header="Gain">
        <template #body="{ data }">
          <span
            :class="{
              'text-green-400': data.count > 0,
            }"
            >{{ data.count }}</span
          >
        </template>
      </Column>
      <Column v-if="withTimeRange" field="allPeriods" header="All Periods">
        <template #body="{ data }">
          <span
            :class="
              data.allPeriods < data.count
                ? 'text-green-400'
                : data.allPeriods > data.count
                ? 'text-orange-300'
                : 'text-color-secondary'
            "
            >{{
              data.allPeriods < data.count ? '>' : data.allPeriods > data.count ? '<' : '='
            }}</span
          >
          <span class="text-color-secondary">&nbsp;{{ data.allPeriods }}</span>
        </template>
      </Column>
    </DataTable>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, shallowRef } from 'vue'
import ProgressSpinner from 'primevue/progressspinner'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputSwitch from 'primevue/inputswitch'
import vTooltip from 'primevue/tooltip'
import type { Log } from '@/types/Log'
import { round } from '@/lib'
import { DAY_DELIMITATION } from '@/constants'
import InfoButton from './InfoButton.vue'

const createWeekSlices = () => {
  return Array.from({ length: 24 }, (_, index) => ({
    name: index + '',
    count: 0,
    allPeriods: 0,
  }))
}

const INIT_WEEK = {
  '1': {
    name: 'monday',
    slices: createWeekSlices(),
    order: 1,
  },
  '2': {
    name: 'tuesday',
    slices: createWeekSlices(),
    order: 2,
  },
  '3': {
    name: 'wednesday',
    slices: createWeekSlices(),
    order: 3,
  },
  '4': {
    name: 'thursday',
    slices: createWeekSlices(),
    order: 4,
  },
  '5': {
    name: 'friday',
    slices: createWeekSlices(),
    order: 5,
  },
  workdays: {
    name: 'workdays',
    slices: createWeekSlices(),
    order: 6,
  },
  '6': {
    name: 'saturday',
    slices: createWeekSlices(),
    order: 7,
  },
  '0': {
    name: 'sunday',
    slices: createWeekSlices(),
    order: 8,
  },
  weekend: {
    name: 'weekend',
    slices: createWeekSlices(),
    order: 9,
  },
  overall: {
    name: 'overall',
    slices: createWeekSlices(),
    order: 10,
  },
}

const props = defineProps<{
  logs: Log[]
  timeOnCreation?: boolean
  withTimeRange?: boolean
}>()

const loading = ref(false)
const week = shallowRef(structuredClone(INIT_WEEK))
const onlyWinners = ref(false)

// table with 1 hour each row
const hoursData = computed(() =>
  Object.values(week.value)
    .toSorted((d1, d2) => (d1.order > d2.order ? 1 : -1))
    .reduce((arr, day) => {
      for (const slice of day.slices) {
        arr.push({
          id: `${day.name}-${slice.name}`,
          dayName: day.name,
          sliceName: slice.name,
          count: round(slice.count),
          allPeriods: round(slice.allPeriods),
        })
      }
      return arr
    }, [] as { id: string; dayName: string; sliceName: string; count: number; allPeriods: number }[]),
)

// table with day each row
const daysData = computed(() =>
  ([1, 2, 3, 4, 5, 6, 0] as const)
    .reduce((arr, dayIndex, orderIndex) => {
      const day = week.value[dayIndex]
      for (const slice of day.slices) {
        // if before DAY_DELIMITATION hour, consider it's yesterday
        const adjustedDayIndex = (
          Number(slice.name) >= DAY_DELIMITATION ? dayIndex : dayIndex === 0 ? 6 : dayIndex - 1
        ) as 0 | 1 | 2 | 3 | 4 | 5 | 6

        if (!arr[adjustedDayIndex])
          arr[adjustedDayIndex] = {
            id: week.value[adjustedDayIndex].name,
            dayName: week.value[adjustedDayIndex].name,
            count: 0,
            allPeriods: 0,
            order: adjustedDayIndex || 7, // sunday 0 at the end
          }

        arr[adjustedDayIndex].count += slice.count
        arr[adjustedDayIndex].allPeriods += slice.allPeriods
      }
      return arr
    }, [] as { id: string; dayName: string; order: number; count: number; allPeriods: number }[])
    .toSorted((d1, d2) => (d1.order > d2.order ? 1 : -1)),
)

const compute = () => {
  loading.value = true
  week.value = structuredClone(INIT_WEEK)

  for (const log of props.logs) {
    if (onlyWinners.value && log.gain <= 0) continue

    let dateStr = (props.timeOnCreation ? log.date : log.creation).replace(' ', 'T')
    if (!dateStr.endsWith('Z')) dateStr += '.000Z'
    const date = new Date(dateStr)
    let day = date.getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6
    const sliceIndex = date.getUTCHours()
    const isInPeriods = !props.withTimeRange || log.flag !== 'off'

    week.value[day].slices[sliceIndex].allPeriods += log.gain
    if (isInPeriods) week.value[day].slices[sliceIndex].count += log.gain

    // overall
    week.value.overall.slices[sliceIndex].allPeriods += log.gain
    if (isInPeriods) week.value.overall.slices[sliceIndex].count += log.gain

    // weekdays or weekend
    const category = day === 0 || day === 6 ? 'weekend' : 'workdays'
    week.value[category].slices[sliceIndex].allPeriods += log.gain
    if (isInPeriods) week.value[category].slices[sliceIndex].count += log.gain
  }

  loading.value = false
}
onMounted(() => compute())
watch([() => props.logs, () => props.timeOnCreation, onlyWinners], () => compute())
</script>
