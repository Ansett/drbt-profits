<template>
  <Dialog
    v-model:visible="visible"
    modal
    dismissableMask
    :style="{
      minWidth: '35rem',
      maxWidth: '80%',
      width: '150rem',
      maxHeight: '80%',
    }"
    @hide="onClose"
  >
    <template #header
      ><div
        class="flex flex-row justify-content-start align-items-center gap-4"
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
      :globalFilterFields="['call.ca', 'call.name']"
      v-model:filters="filters"
      :paginator="diff.length > 20"
      :rows="20"
    >
      <template #empty> No difference... </template>

      <template #header v-if="diff.length">
        <div class="flex flex-wrap justify-content-end">
          <InputGroup class="w-auto">
            <InputGroupAddon>
              <i class="pi pi-search"></i>
            </InputGroupAddon>
            <InputText v-model="filters['global'].value" placeholder="Search" />
            <Button
              icon="pi pi-times"
              outlined
              class="text-color-secondary"
              @click="filters['global'].value = null"
            />
          </InputGroup>
        </div>
      </template>

      <Column sortable field="call.date" header="Date">
        <template #body="{ data }">
          {{ prettifyDate(data.call.date) }}</template
        ></Column
      >
      <Column
        sortable
        field="call.ca"
        header="CA"
        style="word-break: break-all; word-wrap: break-word"
      >
        <template #body="{ data }">
          <CaLink :ca="data.call.ca" gray />
        </template>
      </Column>
      <Column sortable field="call.name" header="Name"></Column>
      <Column sortable field="status" header="Status">
        <template #body="{ data }">
          <Tag
            v-if="data.status === 'added'"
            severity="success"
            value="Added"
          />
          <Tag v-else severity="warning" value="Removed" />
        </template>
      </Column>
      <Column
        sortable
        :field="(d) => (d.call.rug ? -1 : d.call.xs)"
        header="Perf"
      >
        <template #body="{ data }">
          <Tag
            v-if="data.call.rug"
            value="rug"
            :pt="{
              root: { style: { background: 'var(--surface-400)' } },
            }"
          />
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
import { ref, watch } from "vue";
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
import { type CallDiff, type CallArchive, type Call } from "@/types/Call";
import { FilterMatchMode } from "primevue/api";
import { prettifyDate, sleep } from "@/lib";
import Worker from "@/worker?worker";
import CaLink from "./CaLink.vue";

const props = defineProps<{
  archives: CallArchive[];
  current: CallArchive;
}>();
const emit = defineEmits(["closed"]);

const left = ref<CallArchive>(props.archives[0]);
const right = ref<CallArchive>(props.current);
const diff = ref<CallDiff[]>([]);
const loading = ref(true);
const visible = ref(true);
const onClose = async () => {
  await sleep(500);
  emit("closed");
};

const filters = ref({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
});

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
