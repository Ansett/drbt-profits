<template>
  <header
    class="text-2xl md:text-6xl font-light text-color-secondary text-center mb-4"
  >
    Backtesting profits from DRBT
  </header>

  <main>
    <!-- CONFIG -->
    <div
      class="flex flex-column md:flex-row gap-3 md:gap-1 align-items-center md:align-items-start justify-content-center"
    >
      <div class="min-w-min md:w-6 m-1 md:m-5" style="max-width: 50rem">
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
                style="font-size: 5.25rem; color: var(--primary-color)"
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
          class="pb-5 mt-5 md:mt-7"
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
              v-tooltip="'Final wallet worth, starting from 0'"
            >
              Final funds:
              <span class="font-bold text-primary">{{ finalETH }}</span>
              <span class="text-color-secondary"> ETH</span>
            </p>
            <!-- DRAWDOWN -->
            <div
              class="text-lg"
              v-tooltip="
                'The lowest the wallet has fallen to, starting from 0 ETH, during the whole period.'
              "
            >
              Overall drawdown:
              <span class="font-bold text-primary">{{ drawdown }}</span>
              <span class="text-color-secondary"> ETH</span>
            </div>
            <div
              class="text-lg"
              v-tooltip="
                'The lowest the wallet has fallen to, starting from 0 ETH, if you began your strategy at the worst time during the selected period. You need at least this absolute value in your wallet to sustain the strategy.'
              "
            >
              Worst drawdown:
              <span class="font-bold text-primary">{{ worstDrawdown[1] }}</span>
              <span class="text-color-secondary"> ETH </span>
              <span v-if="worstDrawdown[0]" class="text-xs"
                >from {{ worstDrawdown[0] }}</span
              >
            </div>
            <!-- NB CALLS -->
            <p class="mt-3">
              <span class="text-color-secondary">Non-rug calls:</span>
              {{ filteredCalls.length }}
            </p>
            <!-- POST-ATH -->
            <p>
              <span class="text-color-secondary"
                >Not included post-ATH calls:</span
              >
              {{ postATHCount }}
            </p>
            <!-- BUY EXPLANATIONS -->
            <p class="text-sm">
              <span class="text-color-secondary">Buy calculations: </span
              ><span class="font-italic"
                >Investing selected position or max-buy, calculated using $2000
                ETH value, minus gas cost. Buy tax is already subtracted from
                Xs.</span
              >
            </p>
            <!-- SELL EXPLANATIONS -->
            <p class="text-sm">
              <span class="text-color-secondary">Sell calculations: </span
              ><span class="font-italic"
                >Gas and 5% tax are removed from each sales. Investment is
                counted as a loss if not reaching targets.</span
              >
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
              <span class="text-color-secondary"> did </span>
              <span class="font-bold">{{ log.xs }}x</span> ->
              <span
                :class="[
                  'font-bold',
                  log.gain > 0 ? 'text-cyan-300 underline' : 'text-purple-600	',
                ]"
                >{{ (log.gain > 0 ? "+" : "") + log.gain }}</span
              >
            </li>
          </ul>
        </Panel>
      </div>

      <div class="flex flex-column mx-1 md:mx-5 my-2">
        <!-- POSITION -->
        <div class="flex flex-column gap-2 p-3">
          <label for="position-input">Position size</label>
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
            <span class="text-xs">(size % and Xs)</span></label
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
          </InputGroup>
        </div>
        <!-- TP 2 -->
        <div class="flex flex-column gap-2 p-3">
          <label for="tp-input"
            >Take profit target 2
            <span class="text-xs">(size % and Xs)</span></label
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
          </InputGroup>
        </div>
        <!-- START -->
        <div class="flex flex-column gap-2 p-3">
          <label for="end-input"
            >Start date at midnight
            <span class="text-xs">(no limit if empty)</span></label
          ><InputGroup>
            <InputGroupAddon>
              <i class="pi pi-calendar-minus"></i>
            </InputGroupAddon>
            <Button icon="pi pi-minus" @click="incStartDate(-1)" />
            <InputMask
              v-model="state.startDate"
              id="start-input"
              style="height: 4rem"
              mask="9999-99-99"
              placeholder="YYYY-MM-DD"
            />
            <Button icon="pi pi-plus" @click="incStartDate()" />
            <Button icon="pi pi-times" outlined @click="state.startDate = ''" />
          </InputGroup>
        </div>
        <!-- END DATE -->
        <div class="flex flex-column gap-2 p-3">
          <label for="end-input"
            >End date at midnight
            <span class="text-xs">(no limit if empty)</span></label
          >
          <InputGroup>
            <InputGroupAddon>
              <i class="pi pi-calendar-plus"></i>
            </InputGroupAddon>
            <Button icon="pi pi-minus" @click="incEndDate(-1)" />
            <InputMask
              v-model="state.endDate"
              id="end-input"
              style="height: 4rem"
              mask="9999-99-99"
              placeholder="YYYY-MM-DD"
            />
            <Button icon="pi pi-plus" @click="incEndDate()" />
            <Button icon="pi pi-times" outlined @click="state.endDate = ''" />
          </InputGroup>
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
import ProgressSpinner from "primevue/progressspinner";
import Button from "primevue/button";
import vTooltip from "primevue/tooltip";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { round2Dec, sleep, debounce } from "./lib";
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
    if (state.startDate) {
      const startTime = state.startDate + "T00:00:00.000Z";
      if (call.date < startTime) return false;
    }
    if (state.endDate) {
      const endTime = state.endDate + "T00:00:00.000Z";
      if (call.date > endTime) return false;
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
  const xsIndex = header.indexOf("CalltoATH_Xs");
  if (xsIndex < 0) return fail("CalltoATH_Xs header not found");
  const supplyIndex = header.indexOf("TSupply");
  if (supplyIndex < 0) return fail("TSupply header not found");
  const maxIndex = header.indexOf("MaxBuyPRCT"); // MaxBuy is not realiable, using percentage instead
  if (maxIndex < 0) return fail("MaxBuyPRCT header not found");
  const mcIndex = header.lastIndexOf("CRT_MC");
  if (mcIndex < 0) return fail("CRT_MC header not found");
  const taxIndex = header.indexOf("BuyTax");
  if (taxIndex < 0) return fail("BuyTax header not found");
  const dateIndex = header.indexOf("Logged");
  if (dateIndex < 0) return fail("Logged header not found");
  const delayIndex = header.indexOf("LaunchedDelay");
  if (delayIndex < 0) return fail("LaunchedDelay header not found");
  const athDelayIndex = header.indexOf("ATHDelay");
  if (athDelayIndex < 0) return fail("ATHDelay header not found");

  let newCalls: Call[] = [];
  for (const row of rows) {
    if (row[rugIndex]) continue;

    let date = row[dateIndex] as string;
    if (!date) continue;
    date = new Date(Date.parse(date)).toISOString();

    newCalls.push({
      name: row[nameIndex] as string,
      ca: row[caIndex] as string,
      xs: row[xsIndex] as number,
      date,
      delay: row[delayIndex] as number,
      athDelay: (row[athDelayIndex] as number) * 60 * 60,
      buyTax: (row[taxIndex] as number) / 100,
      supply: row[supplyIndex] as number,
      maxBuy: ((row[maxIndex] as number) || 100) / 100,
      currentMC: row[mcIndex] as number,
    });
  }
  newCalls.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  calls.value = newCalls;
}

const state = reactive({
  position: 0.05,
  takeProfit1: { size: 50, xs: 10 } as TakeProfit,
  takeProfit2: { size: 50, xs: 100 } as TakeProfit,
  gasPrice: 0.01,
  startDate: "",
  endDate: "",
});

const initialized = ref(false);
const finalETH = ref(0);
const drawdown = ref(0);
const worstDrawdown = ref(["", 0]);
const postATHCount = ref(0);

const STORAGE_KEY = "state-b";
function storeForm() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
watch(state, () => storeForm(), { deep: true });
function loadForm() {
  const savedString = localStorage.getItem(STORAGE_KEY);
  if (savedString) {
    try {
      const savedState = JSON.parse(savedString);
      state.position = savedState.position;
      state.takeProfit1 = savedState.takeProfit1;
      state.takeProfit2 = savedState.takeProfit2;
      state.gasPrice = savedState.gasPrice;
      state.startDate = savedState.startDate;
      state.endDate = savedState.endDate;
    } catch (e) {}
  }
}
onMounted(() => {
  loadForm();
  initialized.value = true;
});

const incStartDate = (inc = 1) => {
  const base = state.startDate || filteredCalls.value[0]?.date || "";
  if (!base) return;
  const offset = state.startDate ? inc : 0;
  const current = new Date(base);
  current.setDate(current.getDate() + offset);
  state.startDate = current.toISOString().split("T")[0];
};
const incEndDate = (inc = 1) => {
  const base =
    state.endDate ||
    filteredCalls.value[filteredCalls.value.length - 1]?.date ||
    "";
  if (!base) return;
  const offset = state.endDate ? inc : 1;
  const current = new Date(base);
  current.setDate(current.getDate() + offset);
  state.endDate = current.toISOString().split("T")[0];
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
  [
    () => state.position,
    () => state.takeProfit1.size,
    () => state.takeProfit1.xs,
    () => state.takeProfit2.size,
    () => state.takeProfit2.xs,
    () => state.gasPrice,
  ],
  () => {
    loading.value = true;
    debouncedCompute();
  }
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
    postATHCount.value = data.postATHCount;
    logs.value = data.logs;
  }
  loading.value = false;
};
worker.onerror = ({ message }) => {
  error.value = message;
};
</script>

<style scoped></style>
