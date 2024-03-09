<template>
  <Dialog
    v-model:visible="visible"
    modal
    dismissableMask
    :style="{
      maxWidth: '90%',
      width: '150rem',
      maxHeight: '90%',
    }"
    :pt="{ content: { class: 'p-0' } }"
    @hide="onClose"
  >
    <template #header>Differences from left to right set of calls</template>

    <div class="flex flex-row flex-wrap column-gap-3 row-gap-2 px-3">
      <Card
        class="flex-grow-1 surface-section relative"
        :pt="{
          content: { class: 'p-0' },
        }"
      >
        <template #title>
          <div class="flex flex-row justify-content-between">
            <Dropdown
              v-model="left"
              optionLabel="fileName"
              :options="archives"
              aria-label="Left file"
              style="max-width: 25rem"
              scrollHeight="275px"
            />
            <Button
              icon="pi pi-code"
              aria-label="Invert"
              raised
              outlined
              class="align-self-end mb-1"
              @click="invert"
            />
          </div>
        </template>
        <template #content>
          <Statistics
            :loading="loadingLeft"
            :finalETH="statsLeft.finalETH"
            :drawdown="statsLeft.drawdown"
            :worstDrawdown="statsLeft.worstDrawdown"
            :counters="statsLeft.counters"
            :nbCalls="left.calls.length"
          />
        </template>
      </Card>

      <Card
        class="flex-grow-1 surface-section"
        :pt="{
          content: { class: 'p-0' },
        }"
      >
        <template #title>
          <Dropdown
            v-model="right"
            optionLabel="fileName"
            :options="archives"
            aria-label="Right file"
            style="max-width: 25rem"
            scrollHeight="275px"
          />
        </template>
        <template #content>
          <Statistics
            :loading="loadingRight"
            :finalETH="statsRight.finalETH"
            :drawdown="statsRight.drawdown"
            :worstDrawdown="statsRight.worstDrawdown"
            :counters="statsRight.counters"
            :nbCalls="right.calls.length"
          />
        </template>
      </Card>
    </div>

    <DataTable
      :value="diff"
      dataKey="call.ca"
      :sortField="(d) => (d.call.rug ? -1 : d.call.xs)"
      :sortOrder="-1"
      sortMode="single"
      v-model:filters="filters"
      filterDisplay="row"
      :paginator="diff.length > 20"
      :rows="50"
    >
      <template #empty> No difference... </template>

      <Column
        sortable
        sortField="call.date"
        filterField="call.date"
        :showFilterMenu="false"
        header="Date"
      >
        <template #body="{ data }">
          <span class="flex flex-wrap column-gap-2">
            <span class="nowrap">{{
              prettifyDate(data.call.date, "date")
            }}</span>
            <span class="nowrap text-color-secondary">{{
              prettifyDate(data.call.date, "hour")
            }}</span>
          </span>
        </template>
        <template #filter="{ filterModel, filterCallback }">
          <InputText
            v-model="filterModel.value"
            type="text"
            placeholder="Search"
            class="p-column-filter max-w-20rem"
            @input="filterCallback()"
          />
        </template>
      </Column>
      <Column
        sortable
        sortField="call.name"
        filterField="call.nameAndCa"
        :showFilterMenu="false"
        header="Name & CA"
      >
        <template #body="{ data }">
          <CaLink :name="data.call.name" :ca="data.call.ca" />
        </template>
        <template #filter="{ filterModel, filterCallback }">
          <InputText
            v-model="filterModel.value"
            type="text"
            @input="filterCallback()"
            class="p-column-filter max-w-20rem"
            placeholder="Search"
          />
        </template>
      </Column>
      <Column
        sortable
        field="status"
        sortField="status"
        :showFilterMenu="false"
        header="Status"
      >
        <template #body="{ data }">
          <Tag
            :value="data.status.toLowerCase()"
            :severity="
              data.status === 'ADDED'
                ? 'success'
                : data.status === 'REMOVED'
                ? 'danger'
                : 'primary'
            "
          />
        </template>
        <template #filter="{ filterModel, filterCallback }">
          <MultiSelect
            v-model="filterModel.value"
            :options="allTypes"
            placeholder="Any"
            optionLabel="description"
            optionValue="id"
            :showClear="true"
            class="p-column-filter max-w-20rem"
            @change="filterCallback()"
          />
        </template>
      </Column>
      <Column
        sortable
        :sortField="(d) => (d.call.rug ? -1 : d.call.xs)"
        header="Perf"
      >
        <template #body="{ data }">
          <Tag v-if="data.call.rug" value="rug" severity="warning" />
          <span v-else>{{ data.call.xs }}x</span>
        </template>
      </Column>
    </DataTable>

    <ProgressSpinner
      v-if="loading"
      class="absolute top-50 left-50"
      style="width: 99px; height: 99px; transform: translate(-50%, -50%)"
      :pt="{
        spinner: { style: { animationDuration: '0s' } },
      }"
    />
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch, watchEffect } from "vue";
import Card from "primevue/card";
import Dialog from "primevue/dialog";
import Dropdown from "primevue/dropdown";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Tag from "primevue/tag";
import ProgressSpinner from "primevue/progressspinner";
import InputText from "primevue/inputtext";
import InputGroup from "primevue/inputgroup";
import InputGroupAddon from "primevue/inputgroupaddon";
import Button from "primevue/button";
import MultiSelect from "primevue/multiselect";
import InputMask from "primevue/inputmask";
import { type CallDiff, type CallArchive, type DiffType } from "@/types/Call";
import { FilterMatchMode } from "primevue/api";
import { prettifyDate, sleep } from "@/lib";
import Worker from "@/worker?worker";
import Statistics from "./Statistics.vue";
import CaLink from "./CaLink.vue";
import type { ComputationResult } from "@/types/CpmputationResult";

const props = defineProps<{
  archives: CallArchive[];
  current: CallArchive;
  diffTypes: DiffType[];
  computingParams: {
    position: number;
    gweiDelta: number;
    buyTaxInXs: boolean;
    feeInXs: boolean;
    slippageGuessing: boolean;
    takeProfits: string;
  };
}>();
const emit = defineEmits<{
  (e: "closed"): void;
  (e: "update:diffTypes", selection: DiffType[]): void;
}>();

const currentIndex = props.archives.findIndex(
  (a) => a.fileName === props.current.fileName
);
// previous file, or first one
const left = ref<CallArchive>(props.archives[Math.max(0, currentIndex - 1)]);
// current file, or last one
const right = ref<CallArchive>(
  props.current.fileName === left.value.fileName && props.archives.length > 1
    ? props.archives[props.archives.length - 1]
    : props.current
);
const invert = () => {
  const temp = right.value;
  right.value = left.value;
  left.value = temp;
};

const diff = ref<CallDiff[]>([]);
const loading = ref(true);
const loadingLeft = ref(false);
const loadingRight = ref(false);
const visible = ref(true);
const statsLeft = ref<ComputationResult>({
  finalETH: 0,
  drawdown: 0,
  worstDrawdown: ["", 0],
  counters: {
    rug: 0,
    unrealistic: 0,
    postAth: 0,
    x100: 0,
    x50: 0,
    x10: 0,
  },
  logs: [],
  hashes: {},
  signatures: {},
});
const statsRight = ref<ComputationResult>({
  finalETH: 0,
  drawdown: 0,
  worstDrawdown: ["", 0],
  counters: {
    rug: 0,
    unrealistic: 0,
    postAth: 0,
    x100: 0,
    x50: 0,
    x10: 0,
  },
  logs: [],
  hashes: {},
  signatures: {},
});

const allTypes = [
  { id: "ADDED", description: "added" },
  { id: "REMOVED", description: "removed" },
  { id: "IN-BOTH", description: "in-both" },
];

const onClose = async () => {
  await sleep(500);
  emit("closed");
};

const filters = ref({
  "call.date": {
    value: null,
    matchMode: FilterMatchMode.CONTAINS,
  },
  "call.nameAndCa": {
    value: null,
    matchMode: FilterMatchMode.CONTAINS,
  },
  status: {
    value: props.diffTypes || [],
    matchMode: FilterMatchMode.IN,
  },
});

watchEffect(() => emit("update:diffTypes", filters.value.status.value));

const worker = new Worker();
worker.onmessage = ({ data }) => {
  if (data.type === "DIFF") {
    diff.value = data.diff;
    loading.value = false;
  } else if (data.type === "COMPUTE") {
    if (data.variant === "left") {
      statsLeft.value = data;
      loadingLeft.value = false;
    } else {
      statsRight.value = data;
      loadingRight.value = false;
    }
  }
};

function runCompute(variant: "left" | "right") {
  if (variant === "left") loadingLeft.value = true;
  else loadingRight.value = true;

  worker.postMessage({
    type: "COMPUTE",
    calls: JSON.parse(
      JSON.stringify(variant === "left" ? left.value.calls : right.value.calls)
    ),
    ...props.computingParams,
    variant,
  });
}

async function extractDiff() {
  if (!left.value || !right.value) return;

  loading.value = true;
  worker.postMessage({
    type: "DIFF",
    previousCalls: JSON.parse(JSON.stringify(left.value.calls)),
    newCalls: JSON.parse(JSON.stringify(right.value.calls)),
  });
}

watch(
  [left, right],
  () => {
    extractDiff();
    runCompute("left");
    runCompute("right");
  },
  { immediate: true }
);
</script>

<style scoped>
.invertBtn {
  /* position: absolute;
  right: -32px;
  top: 2px; */
}
</style>
