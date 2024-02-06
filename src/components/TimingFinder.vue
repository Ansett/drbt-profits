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

    <DataTable
      :value="data"
      dataKey="id"
      size="small"
      rowGroupMode="rowspan"
      groupRowsBy="dayName"
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
import { round2Dec } from "@/lib";

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

const data = computed(() =>
  week.value.reduce((arr, day) => {
    for (const slice of day.slices) {
      arr.push({
        id: `${day.name}-${slice.name}`,
        dayName: day.name,
        sliceName: slice.name,
        count: round2Dec(slice.count),
      });
    }
    return arr;
  }, [] as { id: string; dayName: string; sliceName: string; count: number }[])
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
