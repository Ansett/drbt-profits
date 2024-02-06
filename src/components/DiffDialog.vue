<template>
  <Dialog
    v-model:visible="visible"
    modal
    dismissableMask
    :style="{
      maxWidth: '80%',
      width: '150rem',
      maxHeight: '80%',
    }"
    :pt="{ content: { class: 'p-0' } }"
    @hide="onClose"
  >
    <template #header
      ><div
        class="flex flex-row flex-wrap justify-content-start align-items-center column-gap-4 row-gap-2"
      >
        Diff
        <Dropdown
          v-model="left"
          optionLabel="fileName"
          :options="archives"
          aria-label="Left file"
          style="max-width: 25rem"
          scrollHeight="275px"
        />
        <i class="pi pi-arrow-right" style="color: 'var(--primary-color)'"></i>
        <Dropdown
          v-model="right"
          optionLabel="fileName"
          :options="archives"
          aria-label="Right file"
          style="max-width: 25rem"
          scrollHeight="275px"
        />
      </div>
    </template>

    <DataTable
      :value="diff"
      dataKey="call.ca"
      sortField="call.date"
      :sortOrder="-1"
      sortMode="single"
      v-model:filters="filters"
      filterDisplay="row"
      :paginator="diff.length > 20"
      :rows="20"
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
            @change="filterCallback()"
            :options="allTypes"
            placeholder="Any"
            optionLabel="description"
            optionValue="id"
            :showClear="true"
            class="p-column-filter max-w-20rem"
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
import CaLink from "./CaLink.vue";

const props = defineProps<{
  archives: CallArchive[];
  current: CallArchive;
  diffTypes: DiffType[];
}>();
const emit = defineEmits<{
  (e: "closed"): void;
  (e: "update:diffTypes", selection: DiffType[]): void;
}>();

// select first one or last one, depeding if selected archives is already the first or not
const left = ref<CallArchive>(
  props.archives[
    props.current === props.archives[0] ? props.archives.length - 1 : 0
  ]
);
const right = ref<CallArchive>(props.current);
const diff = ref<CallDiff[]>([]);
const loading = ref(true);
const visible = ref(true);

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
  }
  loading.value = false;
};

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
  },
  { immediate: true }
);
</script>
