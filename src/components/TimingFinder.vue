<template>
  <section class="relative">
    <ProgressSpinner
      v-if="loading"
      class="absolute top-0 left-50"
      style="
        width: 99px;
        height: 99px;
        transform: translate(-50%, 50px);
        z-index: 2;
      "
    />

    <div v-if="limited" class="text-red-400 p-3">
      It's better to deactivate "Custom trading periods" switch so this
      simulation evaluates all hours of the week
    </div>

    <DataTable :value="daysData" dataKey="id" size="small" class="pt-4">
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
      <Column field="sliceName" header="Hour slice (UTC)" />
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
    </DataTable>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import ProgressSpinner from "primevue/progressspinner";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import type { Log } from "@/types/Log";
import { round } from "@/lib";
import { DAY_DELIMITATION } from "@/constants";

const createWeekSlices = () => {
  return Array.from({ length: 24 }, (_, index) => ({
    name: index + "",
    count: 0,
  }));
};
const INIT_WEEK = [
  {
    name: "monday",
    slices: createWeekSlices(),
  },
  {
    name: "tuesday",
    slices: createWeekSlices(),
  },
  {
    name: "wednesday",
    slices: createWeekSlices(),
  },
  {
    name: "thursday",
    slices: createWeekSlices(),
  },
  {
    name: "friday",
    slices: createWeekSlices(),
  },
  {
    name: "saturday",
    slices: createWeekSlices(),
  },
  {
    name: "sunday",
    slices: createWeekSlices(),
  },
  {
    name: "overall",
    slices: createWeekSlices(),
  },
  {
    name: "workdays",
    slices: createWeekSlices(),
  },
  {
    name: "weekend",
    slices: createWeekSlices(),
  },
];

// eslint-disable-next-line unused-imports/no-unused-vars-ts
const props = defineProps<{
  logs: Log[];
  limited?: boolean;
}>();

const loading = ref(false);
const week = ref(structuredClone(INIT_WEEK));

// table with 1 hour each row
const hoursData = computed(() =>
  week.value.reduce((arr, day) => {
    for (const slice of day.slices) {
      arr.push({
        id: `${day.name}-${slice.name}`,
        dayName: day.name,
        sliceName: slice.name,
        count: round(slice.count),
      });
    }
    return arr;
  }, [] as { id: string; dayName: string; sliceName: string; count: number }[])
);

// table with day each row
const daysData = computed(() =>
  week.value.slice(0, 7).reduce((arr, day, dayIndex) => {
    for (const slice of day.slices) {
      const adjustedDayIndex =
        Number(slice.name) >= DAY_DELIMITATION
          ? dayIndex
          : dayIndex === 0
          ? 6
          : dayIndex - 1;

      if (!arr[adjustedDayIndex])
        arr[adjustedDayIndex] = {
          id: week.value[adjustedDayIndex].name,
          dayName: week.value[adjustedDayIndex].name,
          count: 0,
        };

      arr[adjustedDayIndex].count += slice.count;
    }
    return arr;
  }, [] as { id: string; dayName: string; count: number }[])
);

const compute = () => {
  loading.value = true;
  week.value = structuredClone(INIT_WEEK);

  for (const log of props.logs) {
    const date = new Date(log.date.replace(" ", "T") + ".000Z");
    let day = date.getUTCDay() - 1;
    if (day === -1) day = 6;
    // const sliceIndex = Math.ceil((date.getUTCHours() + 0.1) / 3) - 1;
    const sliceIndex = date.getUTCHours();
    week.value[day].slices[sliceIndex].count += log.gain;
    // overall
    week.value[7].slices[sliceIndex].count += log.gain;
    // weekdays or weekend
    week.value[day >= 5 ? 9 : 8].slices[sliceIndex].count += log.gain;
  }

  loading.value = false;
};
onMounted(() => compute());
watch(
  () => props.logs,
  () => compute()
);
</script>
