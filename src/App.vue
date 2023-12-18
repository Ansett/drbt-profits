<template>
  <header
    class="text-2xl xl:text-6xl font-light text-color-secondary text-center mb-4"
  >
    Backtesting profits from DRBT
  </header>

  <main>
    <!-- CONFIG -->
    <div
      class="flex flex-column xl:flex-row gap-3 xl:gap-1 align-items-center xl:align-items-start justify-content-center"
    >
      <div class="min-w-min xl:w-6 m-1 xl:m-5" style="max-width: 50rem">
        <FileUpload
          ref="uploader"
          mode="advanced"
          accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          :showUploadButton="false"
          :showCancelButton="false"
          chooseLabel="&nbsp;Import"
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

              <p
                v-if="selectedFile"
                class="text-2xl font-medium text-center mb-2"
              >
                {{ selectedFile.name }}
              </p>
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

        <!-- RESULTS -->
        <Panel
          header="STATISTICS"
          class="pb-5 mt-5 xl:mt-7"
          style="min-height: 11rem"
        >
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
            <p
              class="text-2xl"
              v-tooltip="{
                value:
                  'Final wallet worth, starting from 0.<ul><li>Buy calculations: Investing selected position or max-buy, calculated using $2000 ETH value, minus gas cost and tax.</li><li>Sell calculations: Gas and 5% tax are removed from each sales.</li><li>Investment is counted as a loss if not reaching targets.</li></ul>',
                autoHide: false,
                escape: false,
              }"
            >
              Final funds:
              <span class="font-bold text-primary">{{ finalETH }}</span>
              <span class="text-color-secondary text-lg"> ETH</span>
            </p>
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
                  worstDrawdown[0] ? ` (${worstDrawdown[0]} in this case)` : ''
                }.<br>You need at least this absolute value in your wallet to sustain the strategy.`,
                autoHide: false,
                escape: false,
              }"
            >
              Worst drawdown:
              <span class="font-bold text-primary">{{ worstDrawdown[1] }}</span>
              <span class="text-color-secondary text-xs"> ETH </span>
            </div>
            <!-- NB CALLS -->
            <p
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
            </p>
          </div>
        </Panel>

        <!-- LOGS -->
        <Panel header="LOGS" toggleable collapsed>
          <ul class="px-2">
            <li v-for="log in logs" :key="log.ca" class="text-sm mb-3">
              <!-- {{ log.ca }}<br /> -->
              <span class="">[{{ log.date }}]</span
              ><span class="text-color-secondary"> bought </span
              ><span class="font-bold">{{ log.invested }}</span>
              <span class="text-color-secondary"> of </span>
              <span class="font-bold">{{ log.name }}</span>
              <br />
              <span class="text-xs">{{ log.ca }} </span>
              <br />
              <span class="text-color-secondary"> did </span>
              <span class="font-bold">{{ log.xs }}x</span>
              <span v-if="log.info" class=""> ({{ log.info }})</span>
              <span class="text-color-secondary"> resulting in </span>
              <span
                :class="[
                  'font-bold',
                  log.gain > 0 ? 'text-cyan-300 underline' : 'text-purple-600	',
                ]"
                >{{ (log.gain > 0 ? "+" : "") + log.gain }}</span
              >
              <span class="text-color-secondary"> ETH</span>
            </li>
          </ul>
        </Panel>
      </div>

      <div class="flex flex-column mx-1 xl:mx-5 my-2">
        <!-- POSITION -->
        <div class="flex flex-column gap-2 p-3">
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
              style="height: 4rem"
              suffix=" ETH"
              :min="0.01"
              :minFractionDigits="1"
              :maxFractionDigits="2"
              mode="decimal"
              :step="0.01"
              incrementButtonIcon="pi pi-plus"
              incrementButtonClassName="p-button-secondary"
              decrementButtonIcon="pi pi-minus"
              decrementButtonClassName="p-button-secondary"
            />
          </InputGroup>
        </div>
        <!-- GAP PRICE -->
        <div class="flex flex-column gap-2 p-3">
          <label for="gas-input">Gas price</label>
          <InputGroup>
            <InputGroupAddon>
              <i class="pi pi-money-bill"></i>
            </InputGroupAddon>
            <InputNumber
              v-model="state.gasPrice"
              id="gas-input"
              showButtons
              buttonLayout="stacked"
              style="height: 4rem"
              suffix=" ETH"
              :min="0.005"
              :minFractionDigits="1"
              :maxFractionDigits="3"
              mode="decimal"
              :step="0.005"
              incrementButtonIcon="pi pi-plus"
              incrementButtonClassName="p-button-secondary"
              decrementButtonIcon="pi pi-minus"
              decrementButtonClassName="p-button-secondary"
            />
          </InputGroup>
        </div>
        <!-- TP 1 -->
        <div class="flex flex-column gap-2 p-3">
          <label for="tp-input"
            >Take profit target 1
            <span class="text-xs"
              >(size % and either Xs or fixed MC)</span
            ></label
          >
          <InputGroup>
            <InputGroupAddon>
              <i class="pi pi-send"></i>
            </InputGroupAddon>
            <InputNumber
              v-model="state.takeProfit1.size"
              id="tp-input"
              showButtons
              buttonLayout="stacked"
              style="height: 4rem"
              suffix="%"
              :min="0"
              :max="100"
              :step="10"
              incrementButtonIcon="pi pi-plus"
              incrementButtonClassName="p-button-secondary"
              decrementButtonIcon="pi pi-minus"
              decrementButtonClassName="p-button-secondary"
            />
            <InputNumber
              v-if="state.takeProfit1.fixed"
              v-model="state.takeProfit1.mc"
              id="tp-input"
              showButtons
              buttonLayout="stacked"
              style="height: 4rem"
              prefix="$"
              :min="0"
              :step="100000"
              incrementButtonIcon="pi pi-plus"
              incrementButtonClassName="p-button-secondary"
              decrementButtonIcon="pi pi-minus"
              decrementButtonClassName="p-button-secondary"
            />
            <InputNumber
              v-else
              v-model="state.takeProfit1.xs"
              id="tp-input"
              showButtons
              buttonLayout="stacked"
              style="height: 4rem"
              suffix="x"
              :min="1"
              :step="5"
              incrementButtonIcon="pi pi-plus"
              incrementButtonClassName="p-button-secondary"
              decrementButtonIcon="pi pi-minus"
              decrementButtonClassName="p-button-secondary"
            />
            <InputGroupAddon>
              <Checkbox v-model="state.takeProfit1.fixed" binary />
            </InputGroupAddon>
          </InputGroup>
        </div>
        <!-- TP 2 -->
        <div class="flex flex-column gap-2 p-3">
          <label for="tp-input"
            >Take profit target 2
            <span class="text-xs"
              >(size % and either Xs or fixed MC)</span
            ></label
          >
          <InputGroup>
            <InputGroupAddon>
              <i class="pi pi-send"></i>
            </InputGroupAddon>
            <InputNumber
              v-model="state.takeProfit2.size"
              id="tp2-input"
              showButtons
              buttonLayout="stacked"
              style="height: 4rem"
              suffix="%"
              :min="0"
              :max="100 - state.takeProfit1.size"
              :step="10"
              disabled
              :class="{
                'p-invalid':
                  state.takeProfit1.size + state.takeProfit2.size > 100,
              }"
              incrementButtonIcon="pi pi-plus"
              incrementButtonClassName="p-button-secondary"
              decrementButtonIcon="pi pi-minus"
              decrementButtonClassName="p-button-secondary"
            />
            <InputNumber
              v-if="state.takeProfit2.fixed"
              v-model="state.takeProfit2.mc"
              id="tp-input"
              showButtons
              buttonLayout="stacked"
              style="height: 4rem"
              prefix="$"
              :min="0"
              :step="100000"
              incrementButtonIcon="pi pi-plus"
              incrementButtonClassName="p-button-secondary"
              decrementButtonIcon="pi pi-minus"
              decrementButtonClassName="p-button-secondary"
            />
            <InputNumber
              v-else
              v-model="state.takeProfit2.xs"
              id="tp-input"
              showButtons
              buttonLayout="stacked"
              style="height: 4rem"
              suffix="x"
              :min="1"
              :step="5"
              incrementButtonIcon="pi pi-plus"
              incrementButtonClassName="p-button-secondary"
              decrementButtonIcon="pi pi-minus"
              decrementButtonClassName="p-button-secondary"
            />
            <InputGroupAddon>
              <Checkbox v-model="state.takeProfit2.fixed" binary />
            </InputGroupAddon>
          </InputGroup>
        </div>

        <hr class="m-3 border-1 border-solid border-indigo-900" />

        <!-- START -->
        <div class="flex flex-column gap-2 p-3">
          <label for="end-input"
            >Start date <span class="text-xs">(no limit if empty)</span></label
          ><InputGroup>
            <InputGroupAddon>
              <i class="pi pi-calendar-minus"></i>
            </InputGroupAddon>
            <Button icon="pi pi-minus" @click="incStartDate(-1)" />
            <InputMask
              v-model="selection.startDate"
              id="start-input"
              style="height: 4rem"
              mask="9999-99-99"
              placeholder="YYYY-MM-DD"
            />
            <Button icon="pi pi-plus" @click="incStartDate()" />
            <InputMask
              v-model="selection.startHour"
              id="starth-input"
              style="height: 4rem"
              mask="99:99"
              placeholder="00:00"
            />
            <Button
              icon="pi pi-times"
              outlined
              @click="
                selection.startDate = '';
                selection.startHour = '';
              "
            />
          </InputGroup>
        </div>
        <!-- END DATE -->
        <div class="flex flex-column gap-2 p-3">
          <label for="end-input"
            >End date <span class="text-xs">(no limit if empty)</span></label
          >
          <InputGroup>
            <InputGroupAddon>
              <i class="pi pi-calendar-plus"></i>
            </InputGroupAddon>
            <Button icon="pi pi-minus" @click="incEndDate(-1)" />
            <InputMask
              v-model="selection.endDate"
              id="end-input"
              style="height: 4rem"
              mask="9999-99-99"
              placeholder="YYYY-MM-DD"
            />
            <Button icon="pi pi-plus" @click="incEndDate()" />
            <InputMask
              v-model="selection.endHour"
              id="endh-input"
              style="height: 4rem"
              mask="99:99"
              placeholder="00:00"
            />
            <Button
              icon="pi pi-times"
              outlined
              @click="
                selection.endDate = '';
                selection.endHour = '';
              "
            />
          </InputGroup>
        </div>
        <!-- RANGE -->
        <div class="flex flex-column gap-2 p-3">
          <label for="end-input"
            >Trading hours each day <span class="text-xs">(UTC)</span></label
          >
          <div class="flex flex-row gap-2">
            <div class="flex flex-column" style="flex: 1 1 50%">
              <InputText
                v-model="rangeStartIso"
                disabled
                style="height: 4rem"
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
            <div class="flex flex-column" style="flex: 1 1 50%">
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
        <div class="flex flex-column gap-2 p-3">
          <label>Trading days <span class="text-xs">(UTC)</span></label>
          <div class="card flex flex-wrap justify-content-start gap-5">
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
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
// https://primevue.org/icons/#list
// https://primeflex.org/flexdirection
import InputNumber from "primevue/inputnumber";
import InputGroup from "primevue/inputgroup";
import InputGroupAddon from "primevue/inputgroupaddon";
import FileUpload, { type FileUploadSelectEvent } from "primevue/fileupload";
import Panel from "primevue/panel";
import Message from "primevue/message";
import InputMask from "primevue/inputmask";
import InputText from "primevue/inputtext";
import InputSwitch from "primevue/inputswitch";
import ProgressSpinner from "primevue/progressspinner";
import Button from "primevue/button";
import Slider from "primevue/slider";
import Checkbox from "primevue/checkbox";
import vTooltip from "primevue/tooltip";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { round2Dec, sleep, debounce, decimalHourToString } from "./lib";
import type { Call } from "./types/Call";
import type { Log } from "./types/Log";
import Worker from "./worker?worker";
import type { TakeProfit } from "./types/TakeProfit";

const error = ref("");
const loading = ref(false);
const uploader = ref<InstanceType<typeof FileUpload>>();

const selectedFile = ref<File | null>(null);
const onUpload = async (event: FileUploadSelectEvent) => {
  const { files } = event;
  if (!files?.length) return;

  selectedFile.value = files[0];
  (uploader.value as any)?.clear();

  loading.value = true;
  worker.postMessage({ type: "XLSX", xlsx: selectedFile.value });
};

const logs = ref<Log[]>([]);
const calls = ref<Call[]>([]);
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

async function storeData(rows: (string | number)[][]) {
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
  const taxIndex = header.indexOf("BuyTax");
  if (taxIndex < 0) return fail("BuyTax header not found");
  const dateIndex = header.indexOf("Logged");
  if (dateIndex < 0) return fail("Logged header not found");
  const delayIndex = header.indexOf("LaunchedDelay");
  if (delayIndex < 0) return fail("LaunchedDelay header not found");
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
      xs: row[xsIndex] as number,
      ath: row[athIndex] as number,
      callTimeAth: row[callAthIndex] as number,
      date,
      delay: row[delayIndex] as number,
      // athDelay: row[athDelayIndex] as number,
      buyTax: (row[taxIndex] as number) / 100,
      supply: row[supplyIndex] as number,
      maxBuy: ((row[maxIndex] as number) || 100) / 100,
      currentMC: row[mcIndex] as number,
      rug: !!row[rugIndex],
    });
  }
  newCalls.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  calls.value = newCalls;
}

const INIT_POSITION = 0.05;
const INIT_TP1 = { size: 50, xs: 10, mc: 250000, fixed: false } as TakeProfit;
const INIT_TP2 = { size: 50, xs: 100, mc: 2500000, fixed: false } as TakeProfit;
const INIT_GAS = 0.01;
const state = reactive({
  position: INIT_POSITION,
  takeProfit1: INIT_TP1,
  takeProfit2: INIT_TP2,
  gasPrice: INIT_GAS,
});
watch(
  () => state.takeProfit1.size,
  (size1) => {
    state.takeProfit2.size = 100 - state.takeProfit1.size;
  }
);

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

const STORAGE_KEY = "state-c";
function storeForm() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
watch(state, () => storeForm(), { deep: true });
function loadForm() {
  const savedString = localStorage.getItem(STORAGE_KEY);
  if (savedString) {
    try {
      const savedState = JSON.parse(savedString);
      state.position = savedState.position ?? INIT_POSITION;
      state.takeProfit1 = savedState.takeProfit1 ?? INIT_TP1;
      if (!state.takeProfit1.mc) state.takeProfit1.mc = INIT_TP1.mc;
      if (!state.takeProfit1.fixed) state.takeProfit1.fixed = INIT_TP1.fixed;
      state.takeProfit2 = savedState.takeProfit2 ?? INIT_TP2;
      if (!state.takeProfit2.mc) state.takeProfit2.mc = INIT_TP2.mc;
      if (!state.takeProfit2.fixed) state.takeProfit2.fixed = INIT_TP2.fixed;
      state.gasPrice = savedState.gasPrice ?? INIT_GAS;
    } catch (e) {}
  }
}
onMounted(() => {
  loadForm();
  initialized.value = true;
});

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
    takeProfit1: JSON.parse(JSON.stringify(state.takeProfit1)),
    takeProfit2: JSON.parse(JSON.stringify(state.takeProfit2)),
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
  if (data.type === "XLSX") return storeData(data.rows);
  if (data.type === "COMPUTE") {
    finalETH.value = data.finalETH;
    drawdown.value = data.drawdown;
    worstDrawdown.value = data.worstDrawdown;
    counters.value = data.counters;
    logs.value = data.logs;
  }
  loading.value = false;
};
worker.onerror = ({ message }) => {
  error.value = message;
};
</script>

<style scoped></style>
