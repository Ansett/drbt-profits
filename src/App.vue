<template>
  <header
    class="text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-light text-color-secondary text-center xl:text-left my-2 ml-0 xl:ml-6"
  >
    Backtesting profits from DRBT
  </header>

  <main>
    <!-- CONFIG -->
    <div
      class="flex flex-column xl:flex-row gap-3 xl:gap-1 align-items-center xl:align-items-start justify-content-center"
    >
      <div
        class="w-screen xl:w-6 m-1 xl:m-4"
        style="max-width: min(95vw, 75rem)"
      >
        <FileUpload
          ref="uploader"
          mode="advanced"
          accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          :showUploadButton="false"
          :showCancelButton="false"
          chooseLabel="&nbsp;Import"
          :pt="{
            content: 'p-3 xl:p-5',
          }"
          @select="onUpload($event)"
        >
          <template #empty>
            <div
              class="flex flex-column m-1 align-items-center justify-content-center"
            >
              <i
                class="pi pi-file mb-4"
                :style="{
                  fontSize: '5.25rem',
                  color: selectedFile
                    ? 'var(--primary-color)'
                    : 'var(--cyan-300)',
                }"
              />

              <template v-if="selectedFile">
                <InputGroup class="w-auto">
                  <Dropdown
                    v-model="current"
                    optionLabel="fileName"
                    :options="archives"
                    aria-label="Current calls file"
                    style="max-width: 21rem"
                    scrollHeight="300px"
                  >
                    <template #option="{ option, index }">
                      <div class="flex align-items-center gap-3">
                        <div class="flex-auto">{{ option.fileName }}</div>
                        <Button
                          icon="pi pi-trash"
                          severity="secondary"
                          text
                          rounded
                          size="small"
                          aria-label="Delete"
                          @click.stop="removeArchive(index)"
                        />
                      </div>
                    </template>
                  </Dropdown>
                  <Button
                    v-if="archives.length >= 2"
                    icon="pi pi-code"
                    outlined
                    aria-label="Difference"
                    @click="showDiff = true"
                  />
                </InputGroup>
              </template>
              <template v-else>
                <p class="text-center">Drag and drop a DRBT backtest export</p>
                <p class="text-center text-sm font-italic text-color-secondary">
                  Nothing is uploaded, computation is done by your browser
                </p>
              </template>
            </div>
          </template>

          <template #content>
            <div />
          </template>
        </FileUpload>

        <Message v-if="error" severity="error" :icon="'none'" class="m-6">{{
          error
        }}</Message>

        <Accordion :activeIndex="[0]" multiple lazy class="mt-5">
          <!-- RESULTS -->
          <AccordionTab header="STATISTICS">
            <div class="flex flex-column align-items-start relative">
              <ProgressSpinner
                v-if="loading"
                class="absolute top-50 left-50"
                style="
                  width: 99px;
                  height: 99px;
                  transform: translate(-50%, -50%);
                "
              />
              <!-- FUNDS -->
              <div
                class="text-2xl"
                v-tooltip="{
                  value:
                    'Final wallet worth, starting from 0.<ul><li>Buy calculations: Investing selected position or max-buy, calculated using $2000 ETH value, minus gas cost and tax.</li><li>Sell calculations: Gas and 5% tax are removed from each sales.</li><li>Investment is counted as a loss if not reaching targets.</li></ul>',
                  autoHide: false,
                  escape: false,
                }"
              >
                Realized profits:
                <span class="font-bold text-primary">{{ finalETH }}</span>
                <span class="text-color-secondary text-lg"> ETH</span>
              </div>
              <!-- DRAWDOWN -->
              <div
                class="text-lg"
                v-tooltip="{
                  value:
                    'The lowest the wallet has fallen to, starting from 0 ETH, during the whole period.',
                  autoHide: false,
                }"
              >
                Overall drawdown:
                <span class="font-bold text-primary">{{ drawdown }}</span>
                <span class="text-color-secondary text-xs"> ETH</span>
              </div>
              <div
                class="text-lg"
                v-tooltip="{
                  value: `The lowest the wallet has fallen to, starting from 0 ETH, if you began your strategy at the worst time during the selected period${
                    worstDrawdown[0]
                      ? ` (${worstDrawdown[0]} in this case)`
                      : ''
                  }.<br>You need at least this absolute value in your wallet to sustain the strategy.`,
                  autoHide: false,
                  escape: false,
                }"
              >
                Worst drawdown:
                <span class="font-bold text-primary">{{
                  worstDrawdown[1]
                }}</span>
                <span class="text-color-secondary text-xs"> ETH </span>
              </div>
              <!-- NB CALLS -->
              <div
                class="text-lg"
                v-tooltip="{
                  value: `Including<ul>${
                    counters.unrealistic
                      ? `<li>${counters.unrealistic} unrealistic trades where we had to cap Xs</li>`
                      : ''
                  }<li>${counters.rug} rugs</li><li>${
                    counters.postAth
                  } calls that occurred after ATH and thus counted as losses</li><li>${
                    counters.x100
                  } calls that made 100x</li><li>${
                    counters.x50
                  } calls that made 50x</li><li>${
                    counters.x10
                  } calls that made 10x</li></ul>`,
                  autoHide: false,
                  escape: false,
                }"
              >
                <span class="">Number of calls: </span>
                <span class="text-primary">{{ filteredCalls.length }}</span>
              </div>
            </div>
          </AccordionTab>

          <!-- LOGS -->
          <AccordionTab
            header="LOGS"
            :pt="{
              root: { class: 'relative' },
              content: { class: 'p-0' },
            }"
          >
            <Button
              :icon="'pi ' + (state.textLogs ? 'pi-list' : 'pi-table')"
              size="small"
              text
              raised
              class="accordion-button"
              aria-label="Logs view"
              v-tooltip.left="
                state.textLogs ? 'Switch to table view' : 'Swith to text view'
              "
              @click.stop="state.textLogs = !state.textLogs"
            />

            <template v-if="state.textLogs">
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
                  <span v-if="log.info" class="font-bold">
                    ({{ log.info }})</span
                  >
                  <span class="text-color-secondary"> resulting in </span>
                  <span
                    :class="[
                      'font-bold',
                      log.gain > 0
                        ? 'text-cyan-300 underline'
                        : 'text-purple-600	',
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
              :sortOrder="1"
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
                :field="(d) => prettifyDate(d.date)"
                header="Date"
                sortable
                :pt="{ headerTitle: { class: 'text-sm' } }"
              >
                <template #body="{ data }">
                  <span class="flex flex-wrap column-gap-2">
                    <span class="nowrap">{{
                      prettifyDate(data.date, "date")
                    }}</span>
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
                field="ath"
                header="ATH"
                sortable
                :pt="{ headerTitle: { class: 'text-sm' } }"
              >
                <template #body="{ data }">
                  <span
                    :class="{ 'text-color-secondary font-italic': data.rug }"
                    >{{ prettifyMc(data.ath) }}</span
                  >
                </template></Column
              >
              <Column
                field="gain"
                header="Gain"
                sortable
                :pt="{ headerTitle: { class: 'text-sm' } }"
              >
                <template #body="{ data }">
                  <span v-if="data.gain <= 0">{{ data.gain }}</span>
                  <span
                    v-else
                    class="flex flex-wrap column-gap-2 align-items-center"
                  >
                    <span class="font-bold text-cyan-300">{{
                      "+" + data.gain
                    }}</span>
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
          </AccordionTab>

          <!-- HASHES -->
          <AccordionTab
            header="FUNCTIONS HASH"
            :pt="{ content: { class: 'p-0' } }"
          >
            <HashTable
              :lines="hashesWithTags"
              filter-template="~HashF.str.contains('{}', na=False)"
              v-model:selectedColumns="state.hashColumns"
              @removeTag="removeTag"
              @addTag="addTag"
            />
          </AccordionTab>

          <!-- SIGNATURES -->
          <AccordionTab
            header="FUNCTION SIGNATURE"
            :pt="{ content: { class: 'p-0' } }"
          >
            <HashTable
              :lines="signaturesWithTags"
              filter-template="~FList.str.contains('{}', na=False)"
              v-model:selectedColumns="state.hashColumns"
              @removeTag="removeTag"
              @addTag="addTag"
            />
          </AccordionTab>
        </Accordion>
      </div>

      <div
        class="flex flex-column mx-1 xl:mx-4 my-2 gap-3 lg:gap-4"
        style="max-width: min(95vw, 50rem)"
      >
        <!-- POSITION -->
        <div class="flex flex-column gap-2">
          <label for="position-input">Max bought</label>
          <InputGroup>
            <InputGroupAddon>
              <i class="pi pi-wallet"></i>
            </InputGroupAddon>
            <InputNumber
              v-model="state.position"
              id="position-input"
              showButtons
              buttonLayout="stacked"
              suffix=" ETH"
              :min="0.01"
              :minFractionDigits="1"
              :maxFractionDigits="2"
              mode="decimal"
              :step="0.01"
              :pt="ptNumberInput"
              class="settingInput"
              style="height: 4rem"
            />
          </InputGroup>
        </div>
        <!-- GAP PRICE -->
        <div class="flex flex-column gap-2">
          <label for="gas-input">Gas price</label>
          <InputGroup>
            <InputGroupAddon>
              <span class="material-symbols-outlined">local_gas_station</span>
            </InputGroupAddon>
            <InputNumber
              v-model="state.gasPrice"
              id="gas-input"
              showButtons
              buttonLayout="stacked"
              suffix=" ETH"
              :min="0.005"
              :minFractionDigits="1"
              :maxFractionDigits="3"
              mode="decimal"
              :step="0.005"
              :pt="ptNumberInput"
              class="settingInput"
              style="height: 4rem"
            />
          </InputGroup>
        </div>
        <!-- TP -->
        <div
          v-for="(takeProfit, index) in state.takeProfits"
          :key="index"
          class="flex flex-row flex-wrap gap-2"
        >
          <label :for="'tp-input' + index" class="min-w-full"
            >Take profit target {{ index + 1 }}
            <span class="text-xs">(size % and first encountered MC or Xs)</span>
          </label>

          <!-- TP size -->
          <InputGroup class="flex-1">
            <InputGroupAddon :class="{ 'target-parent': index > 0 }">
              <i class="pi pi-send target-icon"></i>
              <Button
                v-if="index > 0"
                icon="pi pi-times"
                severity="danger"
                text
                aria-label="Remove"
                class="target-remove"
                @click="removeTarget(index)"
              />
            </InputGroupAddon>
            <InputNumber
              v-model="takeProfit.size"
              :id="'tp-input' + index"
              showButtons
              buttonLayout="stacked"
              style="height: 4rem"
              suffix="%"
              :min="0"
              :max="getMaxSize(index)"
              :step="10"
              :pt="ptNumberInput"
              class="settingInputSmall"
            />
          </InputGroup>
          <!-- TP Xs -->
          <InputGroup class="flex-1">
            <InputNumber
              v-model="takeProfit.xs"
              showButtons
              buttonLayout="stacked"
              style="height: 4rem"
              suffix="x"
              :min="1"
              :step="5"
              :pt="ptNumberInput"
              :disabled="!takeProfit.withXs"
              class="settingInputSmall"
            />
            <InputGroupAddon>
              <Checkbox v-model="takeProfit.withXs" binary />
            </InputGroupAddon>
          </InputGroup>
          <!-- TP MC -->
          <InputGroup class="flex-1">
            <InputNumber
              v-model="takeProfit.mc"
              showButtons
              buttonLayout="stacked"
              style="height: 4rem"
              prefix="$"
              :min="0"
              :step="100000"
              :pt="ptNumberInput"
              :disabled="!takeProfit.withMc"
              class="settingInput"
            />
            <InputGroupAddon>
              <Checkbox v-model="takeProfit.withMc" binary />
            </InputGroupAddon>
          </InputGroup>
        </div>
        <Button class="m-3 align-self-start" @click="addTarget"
          >Add a target</Button
        >

        <!-- START -->
        <div class="flex flex-row flex-wrap gap-2">
          <label for="start-input" class="min-w-full"
            >Start date <span class="text-xs">(no limit if empty)</span></label
          >

          <InputGroup class="flex-50">
            <InputGroupAddon>
              <span class="material-symbols-outlined">today</span>
            </InputGroupAddon>
            <Button
              icon="pi pi-minus"
              outlined
              severity="secondary"
              @click="incStartDate(-1)"
            />
            <InputMask
              v-model="selection.startDate"
              id="start-input"
              style="height: 4rem"
              mask="9999-99-99"
              placeholder="YYYY-MM-DD"
              class="settingInput"
            />
            <Button
              icon="pi pi-plus"
              outlined
              severity="secondary"
              @click="incStartDate()"
            />
          </InputGroup>
          <InputGroup class="flex-1">
            <InputMask
              v-model="selection.startHour"
              style="height: 4rem"
              mask="99:99"
              placeholder="00:00"
              class="settingInputSmall"
            />
            <Button
              icon="pi pi-times"
              outlined
              severity="secondary"
              @click="
                selection.startDate = '';
                selection.startHour = '';
              "
            />
          </InputGroup>
        </div>
        <!-- END DATE -->
        <div class="flex flex-row flex-wrap gap-2">
          <label for="end-input" class="min-w-full"
            >End date <span class="text-xs">(no limit if empty)</span></label
          >
          <InputGroup class="flex-50">
            <InputGroupAddon>
              <span class="material-symbols-outlined">event</span>
            </InputGroupAddon>
            <Button
              icon="pi pi-minus"
              outlined
              severity="secondary"
              @click="incEndDate(-1)"
            />
            <InputMask
              v-model="selection.endDate"
              id="end-input"
              style="height: 4rem"
              mask="9999-99-99"
              placeholder="YYYY-MM-DD"
              class="settingInput"
            />
            <Button
              icon="pi pi-plus"
              outlined
              severity="secondary"
              @click="incEndDate()"
            />
          </InputGroup>
          <InputGroup class="flex-1">
            <InputMask
              v-model="selection.endHour"
              style="height: 4rem"
              mask="99:99"
              placeholder="00:00"
              class="settingInputSmall"
            />
            <Button
              icon="pi pi-times"
              outlined
              severity="secondary"
              @click="
                selection.endDate = '';
                selection.endHour = '';
              "
            />
          </InputGroup>
        </div>
        <!-- RANGE -->
        <div class="flex flex-column gap-2">
          <label for="end-input"
            >Trading hours each day <span class="text-xs">(UTC)</span></label
          >
          <div class="flex flex-row gap-2">
            <div class="flex flex-column" style="width: 50%">
              <InputText
                v-model="rangeStartIso"
                disabled
                style="height: 4rem"
                class="settingInputSmall"
              />
              <Slider
                v-model="selection.range[0]"
                :step="0.25"
                :min="0"
                :max="23.75"
                :pt="{
                  root: { class: 'bg-primary' },
                  range: { class: 'bg-gray-600' },
                }"
              />
            </div>
            <div class="flex flex-column" style="width: 50%">
              <InputGroup>
                <InputGroupAddon
                  style="height: 4rem"
                  v-show="selection.range[1] < selection.range[0]"
                  ><i class="pi pi-arrow-right"></i
                ></InputGroupAddon>
                <InputText
                  v-model="rangeEndIso"
                  disabled
                  style="height: 4rem"
                  class="settingInputSmall"
                />
              </InputGroup>

              <Slider
                v-model="selection.range[1]"
                :step="0.25"
                :min="0.25"
                :max="24"
              />
            </div>
          </div>
        </div>
        <!-- DAYS -->
        <div class="flex flex-column gap-2">
          <label>Trading days <span class="text-xs">(UTC)</span></label>
          <div class="card flex flex-wrap justify-content-start gap-3">
            <div
              v-for="(day, index) of allDays"
              :key="index"
              class="flex align-items-center"
            >
              <Checkbox v-model="selection.week[index]" binary :inputId="day" />
              <label :for="day" class="ml-2"> {{ day }} </label>
            </div>
          </div>
        </div>

        <!-- MIN CALLS -->
        <div class="flex flex-column gap-2">
          <label for="gas-input"
            >Minimum calls count to show hashes and signatures</label
          >
          <InputGroup>
            <InputGroupAddon>
              <i class="pi pi-megaphone"></i>
            </InputGroupAddon>
            <InputNumber
              v-model="state.minCallsForHash"
              id="gas-input"
              showButtons
              buttonLayout="stacked"
              style="height: 4rem"
              :min="1"
              :step="10"
              :pt="ptNumberInput"
              class="settingInput"
            />
          </InputGroup>
        </div>
      </div>
    </div>

    <Toast />

    <DiffDialog
      v-if="current && showDiff"
      v-model:diffTypes="state.diffTypes"
      :archives="archives"
      :current="current"
      @closed="showDiff = false"
    />
  </main>
</template>

<script setup lang="ts">
// https://primevue.org/icons/#list
// https://primeflex.org/flexdirection
// https://fonts.google.com/icons?selected=Material+Symbols+Outlined:thumb_up:FILL@0;wght@400;GRAD@0;opsz@24&icon.set=Material+Symbols&icon.style=Outlined
import InputNumber from "primevue/inputnumber";
import InputGroup from "primevue/inputgroup";
import InputGroupAddon from "primevue/inputgroupaddon";
import FileUpload, { type FileUploadSelectEvent } from "primevue/fileupload";
import Accordion from "primevue/accordion";
import AccordionTab from "primevue/accordiontab";
import Message from "primevue/message";
import InputMask from "primevue/inputmask";
import InputText from "primevue/inputtext";
import ProgressSpinner from "primevue/progressspinner";
import Button from "primevue/button";
import Slider from "primevue/slider";
import Checkbox from "primevue/checkbox";
import vTooltip from "primevue/tooltip";
import HashTable from "./components/HashTable.vue";
import DiffDialog from "./components/DiffDialog.vue";
import CaLink from "./components/CaLink.vue";
import Toast from "primevue/toast";
import Dropdown from "primevue/dropdown";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Tag from "primevue/tag";
import VirtualScroller from "primevue/virtualscroller";
import Paginator from "primevue/paginator";
import { computed, onMounted, reactive, ref, watch } from "vue";
import {
  debounce,
  decimalHourToString,
  localStorageSetObject,
  localStorageGetObject,
  addTagsToHashes,
  sumObjectProperty,
  prettifyDate,
  prettifyMc,
} from "./lib";
import { type CallArchive, type Call, type DiffType } from "./types/Call";
import type { Log } from "./types/Log";
import Worker from "./worker?worker";
import type { TakeProfit } from "./types/TakeProfit";
import type { HashInfo } from "./types/HashInfo";
import { FilterMatchMode } from "primevue/api";

const error = ref("");
const loading = ref(false);
const uploader = ref<InstanceType<typeof FileUpload>>();

const onUpload = async (event: FileUploadSelectEvent) => {
  const { files } = event;
  if (!files?.length) return;

  const xlsx = files[0];
  (uploader.value as any)?.clear();

  loading.value = true;
  worker.postMessage({ type: "XLSX", xlsx });
};

const showDiff = ref(false);
const logs = ref<Log[]>([]);
const logsPage = ref(0);
const logsRowCount = ref(20);
const logTable = ref<InstanceType<typeof DataTable>>();
const exportLogs = () => logTable.value?.exportCSV();

const TAGS_STORAGE_KEY = "tags";
const localTags = ref<Record<string, string[]>>(
  localStorageGetObject(TAGS_STORAGE_KEY) || {}
);

const removeTag = (hash: string, index: number) => {
  localTags.value[hash]?.splice(index, 1);
};
const addTag = (hash: string, newTag: string) => {
  if (!localTags.value[hash]) localTags.value[hash] = [];
  localTags.value[hash].push(newTag);
};
watch(
  localTags,
  () => {
    localStorageSetObject(TAGS_STORAGE_KEY, localTags.value);
  },
  { deep: true }
);

const hashes = ref<Record<string, HashInfo>>({});
const hashesWithTags = computed<HashInfo[]>(() =>
  addTagsToHashes(hashes.value, localTags.value, state.minCallsForHash)
);
const signatures = ref<Record<string, HashInfo>>({});
const signaturesWithTags = computed<HashInfo[]>(() =>
  addTagsToHashes(signatures.value, localTags.value, state.minCallsForHash)
);

const archives = ref<CallArchive[]>([]);
const current = ref<CallArchive | null>(null);
const removeArchive = (index: number) => {
  if (archives.value[index].fileName === current.value?.fileName)
    current.value = archives.value[0];
  archives.value.splice(index, 1);
};

const selectedFile = computed(() => current.value?.fileName || "");
const calls = computed(() => current.value?.calls || []);
const filteredCalls = computed<Call[]>(() =>
  calls.value.filter((call) => {
    // filtering period
    if (selection.startDate) {
      const time = selection.startHour?.match(/\d\d:\d\d/)
        ? selection.startHour
        : "00:00";
      const fullStart = `${selection.startDate}T${time}:00.000Z`;
      if (call.date < fullStart) return false;
    }
    if (selection.endDate) {
      const time = selection.endHour?.match(/\d\d:\d\d/)
        ? selection.endHour
        : "00:00";
      const fullEnd = `${selection.endDate}T${time}:00.000Z`;
      if (call.date > fullEnd) return false;
    }

    // filtering trading hours
    if (
      adjustedRange.value.start !== RANGE_FULL_TIME_START ||
      adjustedRange.value.end !== RANGE_FULL_TIME_END
    ) {
      const hourChunk = call.date.match(/T(\d\d:\d\d:\d\d)/)![1];
      if (
        adjustedRange.value.start <= adjustedRange.value.end &&
        (hourChunk < adjustedRange.value.start ||
          hourChunk > adjustedRange.value.end)
      )
        return false;
      if (
        adjustedRange.value.start > adjustedRange.value.end &&
        hourChunk < adjustedRange.value.start &&
        hourChunk > adjustedRange.value.end
      )
        return false;
    }

    // filtering days
    if (selection.week.some((active) => !active)) {
      const callDay = new Date(call.date).getUTCDay();
      if (!selection.week[callDay]) return false;
    }

    return true;
  })
);

async function storeData(rows: (string | number)[][], fileName: string) {
  const header = rows[0];
  rows.splice(0, 1);
  if (!rows.length) return;

  const nameIndex = header.indexOf("Name");
  if (nameIndex < 0) return fail("Name header not found");
  const caIndex = header.indexOf("CA");
  if (caIndex < 0) return fail("CA header not found");
  const rugIndex = header.indexOf("Rug");
  if (rugIndex < 0) return fail("Rug header not found");
  const xsIndex = header.indexOf("CalltoATH_Xs"); // storing this from sheet only to remove suspicious Xs, but when computing profits we recalculate Xs from scratch
  if (xsIndex < 0) return fail("CalltoATH_Xs header not found");
  const athIndex = header.indexOf("CRT_ATH_MC");
  if (athIndex < 0) return fail("CRT_ATH_MC header not found");
  const callAthIndex = header.indexOf("ATH_MC");
  if (callAthIndex < 0) return fail("ATH_MC header not found");
  const supplyIndex = header.indexOf("TSupply");
  if (supplyIndex < 0) return fail("TSupply header not found");
  const maxIndex = header.indexOf("MaxBuyPRCT"); // MaxBuy is not realiable, using percentage instead
  if (maxIndex < 0) return fail("MaxBuyPRCT header not found");
  const mcIndex = header.lastIndexOf("CRT_MC"); // taking the second column with same name, the first one is MC at present time, not call-time
  if (mcIndex < 0) return fail("CRT_MC header not found");
  const hashIndex = header.indexOf("HashF");
  if (hashIndex < 0) return fail("HashF header not found");
  const taxIndex = header.indexOf("BuyTax");
  if (taxIndex < 0) return fail("BuyTax header not found");
  const dateIndex = header.indexOf("Logged");
  if (dateIndex < 0) return fail("Logged header not found");
  const delayIndex = header.indexOf("LaunchedDelay");
  if (delayIndex < 0) return fail("LaunchedDelay header not found");
  const fListIndex = header.indexOf("FList");
  if (fListIndex < 0) return fail("FList header not found");
  // const athDelayIndex = header.indexOf("ATHDelay"); // many seconds before current call we had the last ATH
  // if (athDelayIndex < 0) return fail("ATHDelay header not found");

  let newCalls: Call[] = [];
  for (const row of rows) {
    let date = row[dateIndex] as string;
    if (!date) continue;
    date = new Date(Date.parse(date)).toISOString();

    newCalls.push({
      name: row[nameIndex] as string,
      ca: row[caIndex] as string,
      nameAndCa: ((row[nameIndex] as string) + row[caIndex]) as string,
      xs: Number(row[xsIndex] as number) || 0,
      ath: row[athIndex] as number,
      callTimeAth: row[callAthIndex] as number,
      date,
      delay: row[delayIndex] as number,
      // athDelay: row[athDelayIndex] as number,
      fList: row[fListIndex] as string,
      buyTax: (row[taxIndex] as number) / 100,
      supply: row[supplyIndex] as number,
      maxBuy: ((row[maxIndex] as number) || 100) / 100,
      currentMC: row[mcIndex] as number,
      rug: !!row[rugIndex],
      hashF: row[hashIndex] as string,
    });
  }

  newCalls.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const newArchive = { calls: newCalls, fileName };
  current.value = newArchive;
  const existIndex = archives.value.findIndex(
    (a) => a.fileName === newArchive.fileName
  );
  if (existIndex > -1) archives.value.splice(existIndex, 1, newArchive);
  else archives.value.push(newArchive);
}

const INIT_POSITION = 0.05;
const INIT_TP = {
  size: 100,
  xs: 50,
  withXs: true,
  mc: 1000000,
  withMc: true,
} as TakeProfit;
const INIT_GAS = 0.01;
const INIT_MIN_CALLS = 5;
const INIT_HASH_COLUMNS = ["Count", "Average", "x10", "x50", "Tags"];
const INIT_TEXT_LOGS = false;
const INIT_DIFF_TYPES = ["ADDED", "REMOVED"] as DiffType[];
const state = reactive({
  position: INIT_POSITION,
  takeProfits: [INIT_TP],
  gasPrice: INIT_GAS,
  minCallsForHash: INIT_MIN_CALLS,
  hashColumns: INIT_HASH_COLUMNS,
  textLogs: INIT_TEXT_LOGS,
  diffTypes: INIT_DIFF_TYPES,
});

const selection = reactive({
  startDate: "",
  startHour: "",
  endDate: "",
  endHour: "",
  range: [0, 24],
  week: [true, true, true, true, true, true, true], // starting sunday
});

const RANGE_FULL_TIME_START = "00:00:00";
const RANGE_FULL_TIME_END = "23:59:50";
const rangeStartIso = computed(() => decimalHourToString(selection.range[0]));
const rangeEndIso = computed(() => decimalHourToString(selection.range[1]));
const adjustedRange = ref({
  start: RANGE_FULL_TIME_START,
  end: RANGE_FULL_TIME_END,
});
const rangeUpdate = () => {
  adjustedRange.value.start = rangeStartIso.value + ":00";
  adjustedRange.value.end =
    rangeEndIso.value === "24:00"
      ? RANGE_FULL_TIME_END
      : rangeEndIso.value + ":59 ";
};
const debouncedRangeUpdate = debounce(rangeUpdate, 500);
watch([rangeStartIso, rangeEndIso], () => debouncedRangeUpdate());

const allDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const initialized = ref(false);
const finalETH = ref(0);
const drawdown = ref(0);
const worstDrawdown = ref(["", 0]);
const counters = ref({
  rug: 0,
  unrealistic: 0,
  postAth: 0,
  x100: 0,
  x50: 0,
  x10: 0,
});

const STATE_STORAGE_KEY = "state-c";
function storeForm() {
  localStorageSetObject(STATE_STORAGE_KEY, state);
}
watch(state, () => storeForm(), { deep: true });
function loadForm() {
  const savedState = localStorageGetObject(STATE_STORAGE_KEY);
  if (!savedState) return;

  state.position = savedState.position ?? INIT_POSITION;
  state.takeProfits = savedState.takeProfits ?? [INIT_TP];
  state.gasPrice = savedState.gasPrice ?? INIT_GAS;
  state.minCallsForHash = savedState.minCallsForHash ?? INIT_MIN_CALLS;
  state.hashColumns = savedState.hashColumns ?? INIT_HASH_COLUMNS;
  state.textLogs = savedState.textLogs ?? INIT_TEXT_LOGS;
  state.diffTypes = savedState.diffTypes ?? INIT_DIFF_TYPES;
}
onMounted(() => {
  loadForm();
  initialized.value = true;
});

const logFilters = ref({
  global: { value: null, matchMode: FilterMatchMode.CONTAINS },
});

const addTarget = () => {
  const lastTarget = state.takeProfits[state.takeProfits.length - 1];
  const remainingPct =
    100 - sumObjectProperty(state.takeProfits, (tp) => tp.size);
  state.takeProfits.push({
    ...INIT_TP,
    ...lastTarget,
    size: remainingPct,
  });
};
const removeTarget = (index: number) => {
  state.takeProfits.splice(index, 1);
};

const getMaxSize = (index: number): number => {
  const otherTps = [...state.takeProfits];
  otherTps.splice(index, 1);
  return 100 - sumObjectProperty(otherTps, (tp) => tp.size);
};

const incStartDate = (inc = 1) => {
  const base = selection.startDate || filteredCalls.value[0]?.date || "";
  if (!base) return;
  const offset = selection.startDate ? inc : 0;
  const current = new Date(base);
  current.setDate(current.getDate() + offset);
  selection.startDate = current.toISOString().split("T")[0];
};
const incEndDate = (inc = 1) => {
  const base =
    selection.endDate ||
    filteredCalls.value[filteredCalls.value.length - 1]?.date ||
    "";
  if (!base) return;
  const offset = selection.endDate ? inc : 1;
  const current = new Date(base);
  current.setDate(current.getDate() + offset);
  selection.endDate = current.toISOString().split("T")[0];
};

const runCompute = () =>
  worker.postMessage({
    type: "COMPUTE",
    calls: JSON.parse(JSON.stringify(filteredCalls.value)),
    position: state.position,
    gasPrice: state.gasPrice,
    takeProfits: JSON.parse(JSON.stringify(state.takeProfits)),
  });
const debouncedCompute = debounce(runCompute, 1000);
watch(filteredCalls, () => {
  if (!initialized.value) return;

  loading.value = true;
  debouncedCompute();
});
watch(
  () => state,
  () => {
    loading.value = true;
    debouncedCompute();
  },
  { deep: true }
);

function fail(message: string) {
  error.value = message;
}

const worker = new Worker();
worker.onmessage = ({ data }) => {
  loading.value = false;

  if (data.type === "XLSX") return storeData(data.rows, data.fileName);
  else if (data.type === "COMPUTE") {
    finalETH.value = data.finalETH;
    drawdown.value = data.drawdown;
    worstDrawdown.value = data.worstDrawdown;
    counters.value = data.counters;
    logs.value = data.logs;
    hashes.value = data.hashes;
    signatures.value = data.signatures;
  } else if (data.type === "DIFF") {
    // callsDiff.value = data.diff;
  }
};
worker.onerror = ({ message }) => {
  error.value = message;
};

const ptNumberInput = {
  decrementButton: {
    root: {
      class: "p-button-outlined p-button-secondary",
    },
  },
  incrementButton: {
    root: {
      class: "p-button-outlined p-button-secondary",
    },
  },
};
</script>

<style scoped>
.settingInput {
  min-width: 10rem;
}
.settingInputSmall {
  min-width: 7rem;
}
.flex-50 {
  flex: 1 1 50%;
}

.target-parent {
  position: relative;
}
.target-icon {
  opacity: 1;
}
.target-remove {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  height: 4rem;
}
.target-parent:hover .target-icon {
  opacity: 0;
}
.target-parent:hover .target-remove {
  opacity: 1;
}
.accordion-button {
  position: absolute;
  right: 0.5rem;
  top: 0.5rem;
  z-index: 2;
}
</style>
