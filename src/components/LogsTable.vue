<template>
  <section>
    <Button
      :icon="'pi ' + (textual ? 'pi-table' : 'pi-list')"
      size="small"
      text
      raised
      class="accordion-button"
      aria-label="Logs view"
      v-tooltip.left="textual ? 'Switch to table view' : 'Swith to text view'"
      @click.stop="textual = !textual"
    />

    <template v-if="textual">
      <ul class="p-3 m-0">
        <li v-if="!logs.length">No calls yet</li>
        <li
          v-else
          v-for="log in logs.slice(logsPage, logsPage + logsRowCount)"
          :key="log.ca"
          class="text-sm mb-3"
        >
          <span class="">[{{ log.date }}]</span><br /><span
            class="text-color-secondary"
          >
            bought </span
          ><span class="font-bold">{{ log.invested }}</span>
          <span class="text-color-secondary"> of </span>
          <CaLink :name="log.name + ''" :ca="log.ca" />
          <br />
          <span class="text-color-secondary"> did </span>
          <span v-if="log.rug" class="text-orange-400">RUG</span>
          <template v-else>
            <span class="font-bold">{{ log.xs }}x</span>
            <span class="text-color-secondary"> to </span>
            <span class="font-bold">{{ prettifyMc(log.ath) }}</span>
          </template>
          <span v-if="log.info" class="font-bold"> ({{ log.info }})</span>
          <span class="text-color-secondary"> resulting in </span>
          <span
            :class="[
              'font-bold',
              log.gain > 0 ? 'text-cyan-300 underline' : 'text-purple-600	',
            ]"
            >{{ (log.gain > 0 ? "+" : "") + log.gain }}</span
          >
          <span class="text-color-secondary"> ETH</span>
          <span v-if="log.hitTp.length">
            (
            {{ log.hitTp.join(" & ") + " hit" }}
            )
          </span>
        </li>
      </ul>
      <Paginator
        v-if="logs.length"
        v-model:first="logsPage"
        v-model:rows="logsRowCount"
        :totalRecords="logs.length"
        paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
        :rowsPerPageOptions="[20, 50, 100]"
      />
    </template>

    <DataTable
      v-else
      ref="logTable"
      :value="logs"
      dataKey="ca"
      size="small"
      sortField="date"
      :sortOrder="-1"
      sortMode="single"
      :paginator="logs.length > 20"
      :rows="20"
      paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
      :rowsPerPageOptions="[20, 50, 100]"
      :globalFilterFields="['ca', 'name', 'date']"
      v-model:filters="logFilters"
    >
      <template #empty> No calls yet </template>

      <template #header v-if="logs.length">
        <div class="flex flex-wrap justify-content-end gap-3">
          <Button
            icon="pi pi-file-export"
            aria-label="Export CSV"
            v-tooltip.top="'Export CSV'"
            @click="exportLogs()"
          />

          <InputGroup class="w-auto">
            <InputGroupAddon class="narrowInput">
              <i class="pi pi-search"></i>
            </InputGroupAddon>
            <InputText
              v-model="logFilters.global.value"
              placeholder="Search"
              class="narrowInput"
            />
            <Button
              icon="pi pi-times"
              outlined
              class="narrowInput text-color-secondary"
              @click="logFilters.global.value = null"
            />
          </InputGroup></div
      ></template>

      <Column
        field="date"
        header="Date"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      >
        <template #body="{ data }">
          <span class="flex flex-wrap column-gap-2">
            <span class="nowrap">{{ prettifyDate(data.date, "date") }}</span>
            <span class="nowrap text-color-secondary">{{
              prettifyDate(data.date, "hour")
            }}</span>
          </span>
        </template>
      </Column>
      <Column
        field="name"
        header="CA"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      >
        <template #body="{ data }">
          <CaLink :name="data.name" :ca="data.ca" />
        </template>
      </Column>
      <Column
        field="invested"
        header="Invested"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      >
        <template #body="{ data }">
          {{ data.invested }}
        </template>
      </Column>
      <Column
        field="gasPrice"
        header="Gas price"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      >
        <template #body="{ data }">
          {{ data.gasPrice }}
        </template>
      </Column>
      <Column
        field="currentMC"
        header="MC"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      >
        <template #body="{ data }">
          {{ prettifyMc(data.currentMC) }}
        </template></Column
      >
      <Column
        field="slippage"
        header="Slippage"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      >
        <template #body="{ data }">
          {{ data.slippage ? data.slippage + "%" : "" }}
        </template></Column
      >
      <Column
        field="ath"
        header="ATH"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      >
        <template #body="{ data }">
          <span :class="{ 'text-color-secondary font-italic': data.rug }">{{
            prettifyMc(data.ath)
          }}</span>
        </template></Column
      >
      <Column
        :field="(d) => (d.rug ? 0 : d.xs)"
        header="Perf"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      >
        <template #body="{ data }">
          <Tag v-if="data.rug" value="rug" severity="warning" />
          <span v-else class="nowrap"
            >{{ data.xs }}x<Tag
              v-if="data.info"
              :value="data.info"
              class="ml-2 nowrap"
              :pt="{
                root: {
                  style: {
                    background: 'var(--cyan-300)',
                  },
                },
              }"
          /></span>
        </template>
      </Column>
      <Column
        field="gain"
        header="Gain"
        sortable
        :pt="{ headerTitle: { class: 'text-sm' } }"
      >
        <template #body="{ data }">
          <span v-if="data.gain <= 0">{{ data.gain }}</span>
          <span v-else class="flex flex-wrap column-gap-2 align-items-center">
            <span class="font-bold text-cyan-300">{{ "+" + data.gain }}</span>
            <span
              v-if="data.hitTp.length"
              class="text-sm text-color-secondary nowrap"
            >
              ({{ data.hitTp.join(" & ") }})
            </span>
          </span>
        </template>
      </Column>
    </DataTable>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { Log } from "@/types/Log";
import { prettifyDate, prettifyMc } from "@/lib";
import { FilterMatchMode } from "primevue/api";
import InputGroup from "primevue/inputgroup";
import InputGroupAddon from "primevue/inputgroupaddon";
import InputText from "primevue/inputtext";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Button from "primevue/button";
import Tag from "primevue/tag";
import Paginator from "primevue/paginator";
import vTooltip from "primevue/tooltip";
import CaLink from "./CaLink.vue";

// eslint-disable-next-line unused-imports/no-unused-vars-ts
const props = defineProps<{
  logs: Log[];
  textual?: boolean;
}>();

const emit = defineEmits<{
  (e: "whatever"): void;
}>();

const textual = defineModel<boolean>("textual", {
  default: false,
});
const logsPage = ref(0);
const logsRowCount = ref(20);

const logTable = ref<InstanceType<typeof DataTable>>();
const exportLogs = () => logTable.value?.exportCSV();

const logFilters = ref({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
});
</script>

<style scoped>
.accordion-button {
  position: absolute;
  right: 0.5rem;
  top: 0.5rem;
  z-index: 2;
}
</style>
