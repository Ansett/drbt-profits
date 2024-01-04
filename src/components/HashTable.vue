<template>
  <div class="relative">
    <DataTable
      ref="table"
      :value="lines"
      sortField="allCalls.length"
      dataKey="id"
      :sortOrder="-1"
      sortMode="single"
      :globalFilterFields="['tags']"
      v-model:filters="filters"
      v-model:selection="selection"
      paginator
      :rows="25"
      @value-change="onDataChange"
    >
      <template #header>
        <div class="flex justify-content-end">
          <SplitButton
            label="Export"
            @click="exporting"
            :model="exportOptions"
            class="mr-3"
          />
          <span class="p-input-icon-left">
            <i class="pi pi-search" />
            <InputText
              v-model="filters['global'].value"
              placeholder="Tag search"
            />
          </span>
        </div>
      </template>

      <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>
      <Column
        field="id"
        header="ID"
        :pt="{ headerTitle: { class: 'text-sm' } }"
      ></Column>
      <Column
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
      <Column
        :field="(d) => '' + Math.round(d.xSum / d.allCalls.length)"
        header="Xs average"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      >
        <template #body="{ data }">
          {{ Math.round(data.xSum / data.allCalls.length) }}
        </template>
      </Column>
      <Column
        :field="(d) => getSortablePct(d.x10Calls.length / d.allCalls.length)"
        header="10x"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      >
        <template #body="{ data }">
          {{ data.x10Calls.length }} ({{
            Math.round((data.x10Calls.length / data.allCalls.length) * 100) +
            "%"
          }})
        </template>
      </Column>
      <Column
        :field="(d) => getSortablePct(d.x50Calls.length / d.allCalls.length)"
        header="50x"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      >
        <template #body="{ data }">
          {{ data.x50Calls.length }} ({{
            Math.round((data.x50Calls.length / data.allCalls.length) * 100) +
            "%"
          }})
        </template>
      </Column>
      <Column
        :field="(d) => getSortablePct(d.rugs / d.allCalls.length)"
        header="Rugs"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      >
        <template #body="{ data }">
          {{ data.rugs }} ({{
            Math.round((data.rugs / data.allCalls.length) * 100) + "%"
          }})
        </template>
      </Column>
      <Column
        :field="(d) => (d.tags ? d.tags.join(', ') : '')"
        header="Tags"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      >
        <template #body="{ data }">
          <i
            class="link pi pi-plus-circle"
            style="font-size: 0.8rem"
            v-tooltip.top="'Add a tag'"
            @click="showTagInput(data.id, $event)"
          ></i>
          <span v-for="(tag, index) in data.tags" :key="index"
            >{{ index ? ", " : " "
            }}<span class="link" @click="removeTag(data.id, index)">{{
              tag
            }}</span></span
          >
        </template>
      </Column>
    </DataTable>

    <!-- Hash calls popup -->
    <Sidebar
      :visible="!!inspectedHash"
      position="right"
      :header="`Calls with hash or sig ${inspectedHash?.id}`"
      class="w-full md:w-30rem"
      @update:visible="inspectedHash = null"
      @hide="inspectedHash = null"
    >
      <ul v-if="inspectedHash" class="px-2">
        <li
          v-for="call in inspectedHash.allCalls"
          :key="call.ca"
          class="text-sm mb-3"
        >
          <a
            class="text-color-secondary hoverlink"
            target="_blank"
            rel="noopener"
            :href="'https://dexscreener.com/ethereum/' + call.ca"
          >
            {{ call.ca }}</a
          >
          <br />
          {{ call.name }}:&nbsp; {{ call.xs }}x
          <span class="text-color-secondary"> {{ prettifyMc(call.ath) }}</span>
          <span v-if="call.rug"> [RUG] </span>
        </li>
      </ul>
    </Sidebar>

    <!-- Tag input -->
    <OverlayPanel ref="tagDropdown">
      <InputGroup>
        <InputGroupAddon>
          <i class="pi pi-tags"></i>
        </InputGroupAddon>
        <InputText
          ref="tagInput"
          type="text"
          v-model="newTag"
          @keyup.enter.native="addTag()"
        />
        <InputGroupAddon>
          <i class="pi pi-reply rotated"></i>
        </InputGroupAddon>
      </InputGroup>
    </OverlayPanel>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import type { HashInfo } from "../types/HashInfo";
import Sidebar from "primevue/sidebar";
import OverlayPanel from "primevue/overlaypanel";
import InputGroup from "primevue/inputgroup";
import InputGroupAddon from "primevue/inputgroupaddon";
import InputText from "primevue/inputtext";
import vTooltip from "primevue/tooltip";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import SplitButton from "primevue/splitbutton";
import { useToast } from "primevue/usetoast";

import { FilterMatchMode, FilterOperator } from "primevue/api";

import { prettifyMc } from "../lib";

const TAG_SEPARATOR = ", ";

const props = defineProps<{
  lines: HashInfo[];
  filterTemplate: string;
}>();
const emit = defineEmits<{
  (e: "removeTag", hash: string, index: number): void;
  (e: "addTag", hash: string, tag: string): void;
}>();

const inspectedHash = ref<HashInfo | null>(null);
const tagDropdown = ref<InstanceType<typeof OverlayPanel>>();
const tagInput = ref();
const newTag = ref("");
const editingForHash = ref("");
const filters = ref({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
});

const removeTag = (hash: string, index: number) =>
  emit("removeTag", hash, index);
const showTagInput = async (hash: string, event: MouseEvent) => {
  editingForHash.value = hash;
  newTag.value = "";
  tagDropdown.value?.show(event);
  await nextTick();
  tagInput.value?.$el.focus();
};
const addTag = () => {
  tagDropdown.value?.hide();
  if (!editingForHash.value) return;
  emit(
    "addTag",
    editingForHash.value,
    newTag.value.trim().replace(TAG_SEPARATOR.trim(), "")
  );
  newTag.value = "";
  editingForHash.value = "";
};

const getSortablePct = (num: number) =>
  ("" + Math.round(num * 100) / 100).padEnd(4, "0");

let currentData: HashInfo[] = [];
// when sorting or searching
const onDataChange = (data: HashInfo[]) => {
  currentData = data;
};
const selection = ref<HashInfo[]>([]);
// when checking rows
const getSelection = () =>
  selection.value.length ? selection.value : currentData;

const table = ref<InstanceType<typeof DataTable>>();
const toast = useToast();
const getIdsString = () =>
  props.filterTemplate.includes("[{}]")
    ? getSelection()
        .map((d) => `'${d.id}'`)
        .join(",")
    : getSelection()
        .map((d) => d.id)
        .join("|");
const getQueryFilter = () => props.filterTemplate.replace("{}", getIdsString());

const exportOptions = [
  {
    label: "Copy IDs",
    icon: "pi pi-list",
    command: () => {
      const list = getIdsString();
      navigator.clipboard.writeText(list);
      toast.add({
        severity: "success",
        summary: "Copied list of IDs to clipboard",
        detail: list.length > 100 ? list.substring(0, 100) + "..." : list,
        life: 5000,
      });
    },
  },
  {
    label: "Copy filter",
    icon: "pi pi-filter",
    command: () => {
      const list = getQueryFilter();
      navigator.clipboard.writeText(list);
      toast.add({
        severity: "success",
        summary: "Copied filter to clipboard",
        detail: list.length > 100 ? list.substring(0, 100) + "..." : list,
        life: 5000,
      });
    },
  },
  {
    label: "Export CSV",
    icon: "pi pi-file-export",
    command: () => {
      table.value?.exportCSV();
    },
  },
];

const exporting = () => exportOptions[0].command();
</script>

<style scoped>
.rotated {
  transform: rotate(-0.5turn);
}
</style>
