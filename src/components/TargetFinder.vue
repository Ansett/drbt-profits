<template>
  <section class="relative">
    <ProgressSpinner
      v-if="loading"
      class="absolute top-0 left-50"
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
        <InputGroupAddon>Increment by</InputGroupAddon>
        <InputNumber
          v-if="selectedtargetKind === 'Xs targets'"
          key="xInc"
          v-model="xIncrement"
          label="increment"
          showButtons
          buttonLayout="stacked"
          suffix="x"
          :min="1"
          :step="5"
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
          :min="100000"
          :step="100000"
          :pt="getPtNumberInput()"
          class="settingInput"
        />
        <InputNumber
          v-else
          key="ethInc"
          v-model="ethIncrement"
          showButtons
          buttonLayout="stacked"
          suffix=" Ξ"
          :min="100000"
          :step="100000"
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
          :min="1"
          :step="5"
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
          key="ethFrom"
          v-model="ethTargetStart"
          showButtons
          buttonLayout="stacked"
          suffix=" Ξ"
          :min="0.1"
          :step="0.5"
          :pt="getPtNumberInput()"
          class="settingInput"
        />
      </InputGroup>
      <InputGroup>
        <InputGroupAddon>To</InputGroupAddon>
        <InputNumber
          v-if="selectedtargetKind === 'Xs targets'"
          key="xTo"
          v-model="xTargetStart"
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
          key="ethTo"
          v-model="ethTargetEnd"
          showButtons
          buttonLayout="stacked"
          suffix=" Ξ"
          :min="ethTargetStart"
          :step="0.5"
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
import { ref, computed, onMounted, watch } from 'vue'
import ProgressSpinner from 'primevue/progressspinner'
import Dropdown from 'primevue/dropdown'
import InputNumber from 'primevue/inputnumber'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import type { Call } from '@/types/Call'
import { getPtNumberInput } from '@/constants'
import Worker from '../worker?worker'
import type { ComputationShortResult } from '@/types/ComputationResult'
import { debounce } from '@/lib'
import type { TakeProfit } from '@/types/TakeProfit'

// eslint-disable-next-line unused-imports/no-unused-vars-ts
const props = defineProps<{
  data: {
    calls: Call[]
    position: number
    gweiDelta: number
    prioBySnipes: [number, number][] | null
    buyTaxInXs: boolean
    feeInXs: boolean
    chainApiKey: string
  }
}>()

const xIncrement = ref(10)
const xTargetStart = ref(50)
const xTargetEnd = ref(300)
const mcIncrement = ref(1000000)
const mcTargetStart = ref(500000)
const mcTargetEnd = ref(25000000)
const ethIncrement = ref(1)
const ethTargetStart = ref(0.5)
const ethTargetEnd = ref(25)

const targetKinds = ['Xs targets', 'ETH targets', 'MC targets']
const selectedtargetKind = ref<'Xs targets' | 'ETH targets' | 'MC targets'>('MC targets')

const loading = ref(false)
const compute = () => {
  loading.value = true
  worker.postMessage({
    type: 'TARGETING',
    calls: JSON.parse(JSON.stringify(props.data.calls)),
    position: props.data.position,
    gweiDelta: props.data.gweiDelta,
    prioBySnipes: props.data.prioBySnipes,
    buyTaxInXs: props.data.buyTaxInXs,
    feeInXs: props.data.feeInXs,
    chainApiKey: props.data.chainApiKey,
    withPriceImpact: false,
    increment:
      selectedtargetKind.value === 'Xs targets'
        ? xIncrement.value
        : selectedtargetKind.value === 'MC targets'
        ? mcIncrement.value
        : ethIncrement.value,
    end:
      selectedtargetKind.value === 'Xs targets'
        ? xTargetEnd.value
        : selectedtargetKind.value === 'MC targets'
        ? mcTargetEnd.value
        : ethTargetEnd.value,
    targetStart: JSON.parse(
      JSON.stringify({
        size: 100,
        xs: xTargetStart.value,
        withXs: selectedtargetKind.value === 'Xs targets',
        mc: mcTargetStart.value,
        withMc: selectedtargetKind.value === 'MC targets',
        eth: ethTargetStart.value,
        withEth: selectedtargetKind.value === 'ETH targets',
        andLogic: false,
      } as TakeProfit),
    ),
  })
}

const result = ref<ComputationShortResult[]>([])
const worker = new Worker()
worker.onmessage = ({ data }) => {
  if (data.type === 'TARGETING') {
    loading.value = false
    result.value = data.result
  }
}

const extremeValues = computed(function () {
  let topProfit = Math.max(...result.value.map(v => v.finalETH))
  if (result.value.every(v => v.finalETH === topProfit)) topProfit = -1
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

const debouncedCompute = debounce(compute, 1000)
onMounted(() => debouncedCompute())
watch(
  [
    () => props.data.calls,
    () => props.data.position,
    () => props.data.gweiDelta,
    () => props.data.prioBySnipes,
    () => props.data.buyTaxInXs,
    () => props.data.feeInXs,
    () => props.data.chainApiKey,
    selectedtargetKind,
    xTargetStart,
    mcTargetStart,
    ethTargetStart,
    xTargetEnd,
    mcTargetEnd,
    ethTargetEnd,
    xIncrement,
    mcIncrement,
    ethIncrement,
  ],
  () => {
    debouncedCompute()
  },
)
</script>
