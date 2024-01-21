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

    <div
      class="flex flex-column md:flex-row md:align-items-center px-3 pt-3 gap-5"
    >
      <div class="flex-none flex flex-row align-items-center gap-3">
        <InputSwitch v-model="withXs" inputId="targetOption" />
        <label for="targetOption">{{
          withXs ? "Xs targets" : "MC targets"
        }}</label>
      </div>
      <InputGroup>
        <InputGroupAddon>Increment by</InputGroupAddon>
        <InputNumber
          v-if="withXs"
          v-model="xIncrement"
          label="increment"
          showButtons
          buttonLayout="stacked"
          suffix="x"
          :min="1"
          :step="5"
          :pt="ptNumberInput"
          class="settingInputSmall"
        />
        <InputNumber
          v-else
          v-model="mcIncrement"
          showButtons
          buttonLayout="stacked"
          prefix="$"
          :min="100000"
          :step="100000"
          :pt="ptNumberInput"
          class="settingInput"
        />
      </InputGroup>
    </div>

    <!-- Target range -->
    <div
      class="flex flex-column md:flex-row md:align-items-center px-3 pt-3 gap-3"
    >
      <InputGroup>
        <InputGroupAddon>From</InputGroupAddon>
        <InputNumber
          v-if="withXs"
          v-model="xTargetStart"
          showButtons
          buttonLayout="stacked"
          suffix="x"
          :min="1"
          :step="5"
          :pt="ptNumberInput"
          class="settingInputSmall"
        />
        <InputNumber
          v-else
          v-model="mcTargetStart"
          showButtons
          buttonLayout="stacked"
          prefix="$"
          :min="10000"
          :step="100000"
          :pt="ptNumberInput"
          class="settingInput"
        />
      </InputGroup>
      <InputGroup>
        <InputGroupAddon>To</InputGroupAddon>
        <InputNumber
          v-if="withXs"
          v-model="xTargetEnd"
          showButtons
          buttonLayout="stacked"
          suffix="x"
          :min="2"
          :step="5"
          :pt="ptNumberInput"
          class="settingInputSmall"
        />
        <InputNumber
          v-else
          v-model="mcTargetEnd"
          showButtons
          buttonLayout="stacked"
          prefix="$"
          :min="20000"
          :step="100000"
          :pt="ptNumberInput"
          class="settingInput"
        />
      </InputGroup>
    </div>

    <!-- Result -->
    <div>
      <div class="ml-3 my-3 font-italic">
        Profit when selling 100% at each target within the range:
      </div>

      <DataTable
        :value="result"
        sortField="target"
        dataKey="target"
        sortMode="single"
        size="small"
      >
        <template #empty>No result yet</template>
        <Column field="target" header="Target" sortable></Column>
        <Column field="finalETH" header="Profit" sortable>
          <template #body="{ data }">
            <span
              :class="{
                'text-green-400': data.finalETH === extremeValues.topProfit,
              }"
              >{{ data.finalETH }}</span
            >
          </template>
        </Column>
        <Column field="drawdown" header="Drawdown" sortable>
          <template #body="{ data }">
            <span
              :class="{
                'text-green-400': data.drawdown === extremeValues.bestDD,
              }"
              >{{ data.drawdown }}</span
            >
          </template></Column
        >
        <Column
          :field="(d) => d.worstDrawdown[1]"
          header="Worst drawdown"
          sortable
          :pt="{ headerTitle: { class: 'text-sm' } }"
        >
          <template #body="{ data }">
            <span
              :class="{
                'text-green-400':
                  data.worstDrawdown[1] === extremeValues.bestWDD,
              }"
              >{{ data.worstDrawdown[1] }}</span
            >
            <span
              v-if="data.worstDrawdown[0]"
              class="text-color-secondary text-xs"
              >&nbsp;starting {{ data.worstDrawdown[0] }}</span
            >
          </template>
        </Column>
      </DataTable>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import ProgressSpinner from "primevue/progressspinner";
import Dropdown from "primevue/dropdown";
import InputNumber from "primevue/inputnumber";
import InputGroup from "primevue/inputgroup";
import InputGroupAddon from "primevue/inputgroupaddon";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import InputSwitch from "primevue/inputswitch";
import type { Call } from "@/types/Call";
import { ptNumberInput } from "@/constants";
import Worker from "../worker?worker";
import type { ComputationShortResult } from "@/types/CpmputationResult";
import { debounce } from "@/lib";

// eslint-disable-next-line unused-imports/no-unused-vars-ts
const props = defineProps<{
  data: {
    calls: Call[];
    position: number;
    gasPrice: number;
    buyTaxInXs: boolean;
  };
}>();

const withXs = ref(true);
const xTargetStart = ref(50);
const mcTargetStart = ref(500000);
const xTargetEnd = ref(150);
const mcTargetEnd = ref(1500000);
const xIncrement = ref(5);
const mcIncrement = ref(100000);

const loading = ref(false);
const compute = () => {
  loading.value = true;
  worker.postMessage({
    type: "TARGETING",
    calls: JSON.parse(JSON.stringify(props.data.calls)),
    position: props.data.position,
    gasPrice: props.data.gasPrice,
    buyTaxInXs: props.data.buyTaxInXs,
    increment: withXs.value ? xIncrement.value : mcIncrement.value,
    end: withXs.value ? xTargetEnd.value : mcTargetEnd.value,
    targetStart: JSON.parse(
      JSON.stringify({
        size: 100,
        xs: xTargetStart.value,
        withXs: withXs.value,
        mc: mcTargetStart.value,
        withMc: !withXs.value,
      })
    ),
  });
};

const result = ref<ComputationShortResult[]>([]);
const worker = new Worker();
worker.onmessage = ({ data }) => {
  loading.value = false;
  if (data.type === "TARGETING") {
    result.value = data.result;
  }
};

const extremeValues = computed(function () {
  let topProfit = Math.max(...result.value.map((v) => v.finalETH));
  if (result.value.every((v) => v.finalETH === topProfit)) topProfit = -1;
  let bestDD = Math.max(...result.value.map((v) => v.drawdown));
  if (result.value.every((v) => v.drawdown === bestDD)) bestDD = -1;
  let bestWDD = Math.max(...result.value.map((v) => v.worstDrawdown[1]));
  if (result.value.every((v) => v.worstDrawdown[1] === bestWDD)) bestWDD = -1;

  return {
    topProfit,
    bestDD,
    bestWDD,
  };
});

const debouncedCompute = debounce(compute, 500);
onMounted(() => debouncedCompute());
watch(
  [
    () => props.data.calls,
    () => props.data.position,
    () => props.data.gasPrice,
    () => props.data.buyTaxInXs,
    () => props.data.buyTaxInXs,
    withXs,
    xTargetStart,
    mcTargetStart,
    xTargetEnd,
    mcTargetEnd,
    xIncrement,
    mcIncrement,
  ],
  () => {
    debouncedCompute();
  }
);
</script>

<style scoped>
/* */
</style>
