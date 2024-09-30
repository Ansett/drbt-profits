<template>
  <Dialog
    v-model:visible="visible"
    modal
    dismissableMask
    :style="{
      maxWidth: '90%',
      width: '150rem',
      maxHeight: '90%',
    }"
    @hide="onClose"
  >
    <template #header
      ><div class="flex flex-row flex-wrap column-gap-3 align-items-center">
        Differences between
        <Dropdown
          v-model="left.archive"
          optionLabel="fileName"
          :options="archives"
          aria-label="Left file"
          style="max-width: 25rem"
          scrollHeight="275px"
        />
        and
        <Dropdown
          v-model="right.archive"
          optionLabel="fileName"
          :options="archives"
          aria-label="Right file"
          style="max-width: 25rem"
          scrollHeight="275px"
        />
        <Button
          icon="pi pi-code"
          raised
          aria-label="Invert"
          v-tooltip.bottom="{
            value: 'Invert sets of calls',
            showDelay: 500,
          }"
          @click="invert"
        />
        <Button
          aria-label="XLSX with all merged calls"
          outlined
          icon="pi pi-download"
          v-tooltip.bottom="{
            value: 'XLSX with all merged calls',
            showDelay: 500,
          }"
          @click="exportXlsx(null, 'Merged')"
        /></div
    ></template>

    <div class="flex flex-row flex-wrap row-gap-5 column-gap-3">
      <Card
        class="flex-grow-1 border-round surface-section relative"
        :pt="{
          content: { class: 'p-0' },
        }"
      >
        <template #title
          ><span class="material-symbols-outlined text-primary icon-with-title vertical-align-top"
            >chevron_left</span
          >
          Calls only in
          {{ left.archive.fileName }}
        </template>
        <template #content>
          <Statistics
            :loading="left.loading"
            :finalETH="left.stats.finalETH"
            :drawdown="left.stats.drawdown"
            :worstDrawdown="left.stats.worstDrawdown"
            :volume="common.stats.volume"
            :counters="left.stats.counters"
            :nbCalls="left.stats.logs.length"
          />

          <LogsTable
            :logs="left.stats.logs"
            v-model:selectedColumns="logsColumns"
            :rows="10"
            initialSort="xs"
            :screener-url="screenerUrl"
            class="mt-3"
            @exportXlsx="exportXlsx($event, 'Left')"
          />
        </template>
      </Card>

      <Card
        class="flex-grow-1 border-round surface-section relative"
        :pt="{
          content: { class: 'p-0' },
        }"
      >
        <template #title
          ><span class="material-symbols-outlined text-primary icon-with-title vertical-align-top"
            >chevron_right</span
          >
          Calls only in
          {{ right.archive.fileName }}
        </template>
        <template #content>
          <Statistics
            :loading="right.loading"
            :finalETH="right.stats.finalETH"
            :drawdown="right.stats.drawdown"
            :worstDrawdown="right.stats.worstDrawdown"
            :volume="common.stats.volume"
            :counters="right.stats.counters"
            :nbCalls="right.stats.logs.length"
          />

          <LogsTable
            :logs="right.stats.logs"
            v-model:selectedColumns="logsColumns"
            :rows="10"
            initialSort="xs"
            :screener-url="screenerUrl"
            class="mt-3"
            @exportXlsx="exportXlsx($event, 'Right')"
          />
        </template>
      </Card>

      <Card
        class="flex-grow-1 border-round surface-section relative"
        :pt="{
          content: { class: 'p-0' },
        }"
      >
        <template #title
          ><span class="material-symbols-outlined text-primary icon-with-title vertical-align-top"
            >code</span
          >
          &nbsp;Calls in both files
        </template>
        <template #content>
          <Statistics
            :loading="common.loading"
            :finalETH="common.stats.finalETH"
            :drawdown="common.stats.drawdown"
            :worstDrawdown="common.stats.worstDrawdown"
            :volume="common.stats.volume"
            :counters="common.stats.counters"
            :nbCalls="common.stats.logs.length"
          />

          <LogsTable
            :logs="common.stats.logs"
            v-model:selectedColumns="logsColumns"
            :rows="10"
            initialSort="xs"
            :screener-url="screenerUrl"
            class="mt-3"
            @exportXlsx="exportXlsx($event, 'Intersection')"
          />
        </template>
      </Card>
    </div>

    <ProgressSpinner
      v-if="loadingDiffs"
      class="absolute top-50 left-50"
      style="width: 99px; height: 99px; transform: translate(-50%, -50%)"
      :pt="{
        spinner: { style: { animationDuration: '0s' } },
      }"
    />
  </Dialog>
</template>

<script setup lang="ts">
import writeXlsxFile from 'write-excel-file'
import { computed, reactive, ref, watch } from 'vue'
import Card from 'primevue/card'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import ProgressSpinner from 'primevue/progressspinner'
import Button from 'primevue/button'
import SplitButton from 'primevue/splitbutton'
import vTooltip from 'primevue/tooltip'
import { type CallDiff, type CallArchive, type DiffType } from '@/types/Call'
import { getRowsCorrespondingToLogs, sleep, downloadRowsXlsx } from '@/lib'
import Worker from '@/worker?worker'
import Statistics from './Statistics.vue'
import type { ComputationResult } from '@/types/ComputationResult'
import LogsTable from './LogsTable.vue'
import type { Call, CallExportType } from '@/types/Call'
import { ComputeVariant } from '@/types/ComputeVariant'
import type { Log } from '@/types/Log'

type DiffPart = {
  archive: CallArchive
  diff: Call[]
  loading: boolean
  stats: ComputationResult
}

const props = defineProps<{
  archives: CallArchive[]
  current: CallArchive
  screenerUrl?: string
  computingParams: {
    position: number
    gweiDelta: number
    prioBySnipes: [number, number][] | null
    buyTaxInXs: boolean
    feeInXs: boolean
    chainApiKey: string
    takeProfits: string
    withPriceImpact: boolean
  }
}>()

const logsColumns = defineModel<string[]>('logsColumns', {
  required: true,
})

const emit = defineEmits<{
  (e: 'closed'): void
}>()

const currentIndex = props.archives.findIndex(a => a.fileName === props.current.fileName)

const getDefaultStats = () =>
  ({
    finalETH: 0,
    drawdown: 0,
    worstDrawdown: ['', 0],
    volume: 0,
    counters: {
      rug: 0,
      unrealistic: 0,
      postAth: 0,
      x100: 0,
      x50: 0,
      x20: 0,
      x10: 0,
      x5: 0,
      x2: 0,
    },
    logs: [],
    hashes: {},
    signatures: {},
  } as ComputationResult)

const left = reactive<DiffPart>({
  // previous file, or first one
  archive: props.archives[Math.max(0, currentIndex - 1)],
  diff: [],
  loading: false,
  stats: getDefaultStats(),
})
const right = reactive<DiffPart>({
  // current file, or last one
  archive:
    props.current.fileName === left.archive.fileName && props.archives.length > 1
      ? props.archives[props.archives.length - 1]
      : props.current,
  diff: [],
  loading: false,
  stats: getDefaultStats(),
})
const common = reactive<DiffPart>({
  archive: {
    fileName: '',
    calls: [],
    rows: [],
    caColumn: 0,
  },
  diff: [],
  loading: false,
  stats: getDefaultStats(),
})

const invert = () => {
  const temp = right.archive
  right.archive = left.archive
  left.archive = temp
}

const loadingDiffs = ref(true)
const visible = ref(true)

const onClose = async () => {
  await sleep(500)
  emit('closed')
}

const worker = new Worker()
worker.onmessage = async ({ data }) => {
  if (data.type === 'DIFF') {
    left.diff = (data.diff as CallDiff[])
      .filter(data => data.status === 'REMOVED')
      .map(data => data.call)
    right.diff = (data.diff as CallDiff[])
      .filter(data => data.status === 'ADDED')
      .map(data => data.call)
    common.diff = (data.diff as CallDiff[])
      .filter(data => data.status === 'IN-BOTH')
      .map(data => data.call)
    loadingDiffs.value = false
  } else if (data.type === 'COMPUTE') {
    if (data.variant === ComputeVariant.LEFT) {
      left.stats = data
      left.loading = false
    } else if (data.variant === ComputeVariant.RIGHT) {
      right.stats = data
      right.loading = false
    } else {
      common.stats = data
      common.loading = false
    }
  }
}

function runCompute(part: DiffPart, variant: ComputeVariant) {
  part.loading = true

  worker.postMessage({
    type: 'COMPUTE',
    calls: JSON.parse(JSON.stringify(part.diff)),
    ...props.computingParams,
    variant,
  })
}

function extractDiff() {
  if (!left.archive || !right.archive) return
  worker.postMessage({
    type: 'DIFF',
    previousCalls: JSON.parse(JSON.stringify(left.archive.calls)),
    newCalls: JSON.parse(JSON.stringify(right.archive.calls)),
  })
}

async function exportXlsx(logs: Log[] | null, type: 'Merged' | 'Left' | 'Right' | 'Intersection') {
  const rowsToExport = getRowsCorrespondingToLogs(
    logs,
    left.archive.caColumn,
    type === 'Right' ? right.archive.rows : left.archive.rows,
    type === 'Merged' || type === 'Intersection' ? right.archive.rows : [],
  )
  await downloadRowsXlsx(rowsToExport, type)
}

watch(
  [() => left.archive, () => right.archive],
  () => {
    extractDiff()
  },
  { immediate: true },
)
watch(
  () => left.diff,
  () => {
    runCompute(left, ComputeVariant.LEFT)
  },
)
watch(
  () => right.diff,
  () => {
    runCompute(right, ComputeVariant.RIGHT)
  },
)
watch(
  () => common.diff,
  () => {
    runCompute(common, ComputeVariant.COMMON)
  },
)
</script>

<style scoped>
.cardExportBtn {
  position: absolute;
  right: 1rem;
  top: 1rem;
}
</style>
