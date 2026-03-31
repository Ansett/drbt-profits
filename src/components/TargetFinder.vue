<template>
  <section class="relative">
    <ProgressSpinner
      v-if="loading"
      class="spinner absolute top-0 left-50"
      style="width: 99px; height: 99px; transform: translate(-50%, 50px); z-index: 2"
    />

    <div class="flex flex-column md:flex-row md:align-items-center px-3 pt-3 gap-3">
      <Dropdown
        v-model="selectedtargetKind"
        :options="targetKinds"
        placeholder="Targeting"
        class="flex-none"
        :pt="{
          root: { class: 'narrowInput' },
          label: { class: 'narrowInput' },
          item: { class: 'pr-5' },
        }"
      />
      <InputGroup>
        <InputGroupAddon>Increment</InputGroupAddon>
        <InputNumber
          v-if="selectedtargetKind === 'Xs targets'"
          key="xInc"
          v-model="xIncrement"
          showButtons
          buttonLayout="stacked"
          suffix="x"
          mode="decimal"
          :min="0.1"
          :step="5"
          :minFractionDigits="0"
          :maxFractionDigits="2"
          :pt="getPtNumberInput()"
          class="settingInputSmall"
        />
        <InputNumber
          v-else-if="selectedtargetKind === 'MC targets'"
          key="mcInc"
          v-model="mcIncrement"
          showButtons
          buttonLayout="stacked"
          prefix="$"
          :min="1000"
          :step="1000"
          :pt="getPtNumberInput()"
          class="settingInput"
        />
        <InputNumber
          v-else
          key="amountInc"
          v-model="amountIncrement"
          showButtons
          buttonLayout="stacked"
          :suffix="suffix"
          :min="amountRange[0] / 2"
          :step="amountRange[0] / 2"
          :pt="getPtNumberInput()"
          class="settingInput"
        />
      </InputGroup>
    </div>

    <!-- Target range -->
    <div class="flex flex-column md:flex-row md:align-items-center px-3 pt-3 gap-3">
      <InputGroup>
        <InputGroupAddon>From</InputGroupAddon>
        <InputNumber
          v-if="selectedtargetKind === 'Xs targets'"
          key="xFrom"
          v-model="xTargetStart"
          showButtons
          buttonLayout="stacked"
          suffix="x"
          mode="decimal"
          :min="0.1"
          :step="5"
          :minFractionDigits="0"
          :maxFractionDigits="2"
          :pt="getPtNumberInput()"
          class="settingInputSmall"
        />
        <InputNumber
          v-else-if="selectedtargetKind === 'MC targets'"
          key="mcFrom"
          v-model="mcTargetStart"
          showButtons
          buttonLayout="stacked"
          prefix="$"
          :min="10000"
          :step="100000"
          :pt="getPtNumberInput()"
          class="settingInput"
        />
        <InputNumber
          v-else
          key="amountFrom"
          v-model="amountTargetStart"
          showButtons
          buttonLayout="stacked"
          :suffix="suffix"
          :min="amountRange[0] / 2"
          :step="amountRange[0] / 2"
          :pt="getPtNumberInput()"
          class="settingInput"
        />
      </InputGroup>
      <InputGroup>
        <InputGroupAddon>To</InputGroupAddon>
        <InputNumber
          v-if="selectedtargetKind === 'Xs targets'"
          key="xTo"
          v-model="xTargetEnd"
          showButtons
          buttonLayout="stacked"
          suffix="x"
          :min="2"
          :step="5"
          :pt="getPtNumberInput()"
          class="settingInputSmall"
        />
        <InputNumber
          v-else-if="selectedtargetKind === 'MC targets'"
          key="mcTo"
          v-model="mcTargetEnd"
          showButtons
          buttonLayout="stacked"
          prefix="$"
          :min="mcTargetStart"
          :step="100000"
          :pt="getPtNumberInput()"
          class="settingInput"
        />
        <InputNumber
          v-else
          key="amountTo"
          v-model="amountTargetEnd"
          showButtons
          buttonLayout="stacked"
          :suffix="suffix"
          :min="amountTargetStart"
          :step="amountRange[0] / 2"
          :pt="getPtNumberInput()"
          class="settingInput"
        />
      </InputGroup>
    </div>

    <!-- Result -->
    <div>
      <div class="ml-3 my-3 font-italic">
        Profit when selling 100% at each target within the range: (price impact is deactivated here)
      </div>

      <DataTable :value="result" sortField="target" dataKey="target" sortMode="single" size="small">
        <template #empty>No result yet</template>
        <Column field="target" header="Target" sortable></Column>
        <Column field="finalWorth" header="Profit" sortable>
          <template #body="{ data }">
            <span
              :class="{
                'text-green-400': data.finalWorth === extremeValues.topProfit,
              }"
              >{{ data.finalWorth }}</span
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
          :field="d => d.worstDrawdown[1]"
          header="Worst drawdown"
          sortable
          :pt="{ headerTitle: { class: 'text-sm' } }"
        >
          <template #body="{ data }">
            <span
              :class="{
                'text-green-400': data.worstDrawdown[1] === extremeValues.bestWDD,
              }"
              >{{ data.worstDrawdown[1] }}</span
            >
            <span v-if="data.worstDrawdown[0]" class="text-color-secondary text-xs"
              >&nbsp;starting {{ data.worstDrawdown[0] }}</span
            >
          </template>
        </Column>
      </DataTable>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, shallowRef } from 'vue'
import ProgressSpinner from 'primevue/progressspinner'
import Dropdown from 'primevue/dropdown'
import InputNumber from 'primevue/inputnumber'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import type { Call, SolCall } from '@/types/Call'
import { getPtNumberInput } from '@/constants'
import type { ComputationShortResult } from '@/types/ComputationResult'
import { debounce } from '@/lib'
import type { TakeProfit } from '@/types/TakeProfit'

const {
  chain = 'ETH',
  data,
  xsRange,
  amountRange,
  mcRange,
  initialKind = 'MC targets',
} = defineProps<{
  chain?: 'ETH' | 'SOL'
  data: {
    calls: Call[] | SolCall[]
    position: number
    gweiDelta?: number
    prioBySnipes?: [number, number][] | null
    buyTaxInXs?: boolean
    feeInXs?: boolean
    chainApiKey?: string
    averageSlippage?: number
    realisticEntry?: boolean
  }
  mcRange: [number, number, number]
  xsRange: [number, number, number]
  amountRange: [number, number, number]
  initialKind?: 'Xs targets' | 'Amount targets' | 'MC targets'
}>()

const emit = defineEmits<{
  (e: 'update:initialKind', value: 'Xs targets' | 'Amount targets' | 'MC targets'): void
  (e: 'update:xsRange', value: [number, number, number]): void
  (e: 'update:mcRange', value: [number, number, number]): void
  (e: 'update:amountRange', value: [number, number, number]): void
}>()

const xTargetStart = computed({
  get: () => xsRange[0],
  set: val => emit('update:xsRange', [val, xsRange[1], xsRange[2]]),
})
const xIncrement = computed({
  get: () => xsRange[1],
  set: val => emit('update:xsRange', [xsRange[0], val, xsRange[2]]),
})
const xTargetEnd = computed({
  get: () => xsRange[2],
  set: val => emit('update:xsRange', [xsRange[0], xsRange[1], val]),
})

const mcTargetStart = computed({
  get: () => mcRange[0],
  set: val => emit('update:mcRange', [val, mcRange[1], mcRange[2]]),
})
const mcIncrement = computed({
  get: () => mcRange[1],
  set: val => emit('update:mcRange', [mcRange[0], val, mcRange[2]]),
})
const mcTargetEnd = computed({
  get: () => mcRange[2],
  set: val => emit('update:mcRange', [mcRange[0], mcRange[1], val]),
})

const amountTargetStart = computed({
  get: () => amountRange[0],
  set: val => emit('update:amountRange', [val, amountRange[1], amountRange[2]]),
})
const amountIncrement = computed({
  get: () => amountRange[1],
  set: val => emit('update:amountRange', [amountRange[0], val, amountRange[2]]),
})
const amountTargetEnd = computed({
  get: () => amountRange[2],
  set: val => emit('update:amountRange', [amountRange[0], amountRange[1], val]),
})

const targetKinds = ['Xs targets', 'Amount targets', 'MC targets']
const selectedtargetKind = computed({
  get: () => initialKind,
  set: val => emit('update:initialKind', val),
})

const suffix = computed(() => ' ' + (chain === 'ETH' ? 'Ξ' : '◎'))
const loading = ref(false)
const result = ref<ComputationShortResult[]>([])
const worker = shallowRef<Worker | null>(null)
const debouncedCompute = debounce(compute, 1000)

onMounted(async () => {
  const WorkerConstructor = (
    await import(chain === 'ETH' ? '@/worker?worker' : '@/worker-sol?worker')
  ).default
  worker.value = new WorkerConstructor()
  worker.value!.onmessage = handleWorkerMessage

  debouncedCompute()
})

async function handleWorkerMessage({ data }: any) {
  if (data.type === 'TARGETING') {
    loading.value = false
    result.value = data.result
  }
}

watch(
  [
    () => data.calls,
    () => data.position,
    () => data.gweiDelta,
    () => data.prioBySnipes,
    () => data.buyTaxInXs,
    () => data.feeInXs,
    () => data.chainApiKey,
    () => data.averageSlippage,
    () => selectedtargetKind.value,
    () => xTargetStart.value,
    () => mcTargetStart.value,
    () => amountTargetStart.value,
    () => xTargetEnd.value,
    () => mcTargetEnd.value,
    () => amountTargetEnd.value,
    () => xIncrement.value,
    () => mcIncrement.value,
    () => amountIncrement.value,
  ],
  () => {
    debouncedCompute()
  },
)

function compute() {
  if (!data.calls.length) return

  loading.value = true
  worker.value!.postMessage({
    type: 'TARGETING',
    calls: JSON.parse(JSON.stringify(data.calls)),
    position: data.position,
    gweiDelta: data.gweiDelta,
    averageSlippage: data.averageSlippage,
    prioBySnipes: data.prioBySnipes,
    buyTaxInXs: data.buyTaxInXs,
    feeInXs: data.feeInXs,
    chainApiKey: data.chainApiKey,
    withPriceImpact: false,
    increment:
      selectedtargetKind.value === 'Xs targets'
        ? xIncrement.value
        : selectedtargetKind.value === 'MC targets'
        ? mcIncrement.value
        : amountIncrement.value,
    end:
      selectedtargetKind.value === 'Xs targets'
        ? xTargetEnd.value
        : selectedtargetKind.value === 'MC targets'
        ? mcTargetEnd.value
        : amountTargetEnd.value,
    targetStart: JSON.parse(
      JSON.stringify({
        size: 100,
        xs: xTargetStart.value,
        withXs: selectedtargetKind.value === 'Xs targets',
        mc: mcTargetStart.value,
        withMc: selectedtargetKind.value === 'MC targets',
        amount: amountTargetStart.value,
        withAmount: selectedtargetKind.value === 'Amount targets',
        andLogic: false,
      } as TakeProfit),
    ),
  })
}

const extremeValues = computed(function () {
  let topProfit = Math.max(...result.value.map(v => v.finalWorth))
  if (result.value.every(v => v.finalWorth === topProfit)) topProfit = -1
  let bestDD = Math.max(...result.value.map(v => v.drawdown))
  if (result.value.every(v => v.drawdown === bestDD)) bestDD = -1
  let bestWDD = Math.max(...result.value.map(v => v.worstDrawdown[1]))
  if (result.value.every(v => v.worstDrawdown[1] === bestWDD)) bestWDD = -1

  return {
    topProfit,
    bestDD,
    bestWDD,
  }
})
</script>
