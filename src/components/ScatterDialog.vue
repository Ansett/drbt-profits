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
    <template #header>Accuracy</template>

    <VueUiScatter :dataset="dataset" :config="config" />
  </Dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { VueUiScatter } from 'vue-data-ui'
import Dialog from 'primevue/dialog'
import { sleep } from '@/lib'
import type { AccuracyLog } from '@/types/Log'
import { EXCLUDED_FROM_ACCURACY } from '../constants'

import 'vue-data-ui/style.css'

const props = defineProps<{
  data: AccuracyLog[] | null
}>()

const emit = defineEmits<{
  (e: 'closed'): void
}>()

const visible = ref(true)

const onClose = async () => {
  await sleep(500)
  emit('closed')
}

const cleanedData = computed(
  () =>
    props.data?.filter(
      d =>
        !EXCLUDED_FROM_ACCURACY.includes(d.ca) &&
        // remove entries where block diff is > 1, indicating my query is now delivering a call with a delay different then it was at the time of launch
        Math.abs(d.realBlock - d.theoricBlock) <= 1,
    ) || [],
)

const dataset = computed(() =>
  props.data
    ? [
        {
          name: 'Accuracy by delay',
          values: cleanedData.value
            .filter(d => d.delay < 30)
            .map(d => ({
              x: d.delay,
              y: d.relativeError,
              name: d.ca,
            })),
        },
        // {
        //   name: 'Accuracy by snipes',
        //   values: cleanedData.value
        //     // .filter(d => d.delay < 30)
        //     .map(d => ({
        //       x: d.delay,
        //       y: d.snipes,
        //       name: d.ca,
        //     })),
        // },
      ]
    : [],
)

const config = {
  useCssAnimation: true,
  style: {
    backgroundColor: '#F3F4F6',
    color: '#1A1A1A',
    fontFamily: 'inherit',
    layout: {
      useDiv: true,
      height: 316,
      width: 512,
      padding: { top: 36, right: 48, bottom: 36, left: 48 },
      axis: { show: true, stroke: '#C4C4C4', strokeWidth: 1 },
      plots: {
        radius: 3,
        stroke: '#F3F4F6',
        strokeWidth: 0.3,
        opacity: 0.6,
        significance: { show: true, deviationThreshold: 30, opacity: 0.3 },
        deviation: { translation: 'deviation', roundingValue: 1 },
      },
      correlation: {
        show: true,
        strokeDasharray: 2,
        strokeWidth: 1,
        label: {
          show: true,
          fontSize: 8,
          color: '#1A1A1A',
          bold: true,
          roundingValue: 2,
          useSerieColor: true,
        },
      },
      dataLabels: {
        xAxis: {
          name: 'xAxis',
          show: true,
          fontSize: 8,
          color: '#1A1A1A',
          bold: false,
          roundingValue: 0,
        },
        yAxis: {
          name: 'yAxis',
          show: true,
          fontSize: 8,
          color: '#1A1A1A',
          bold: false,
          roundingValue: 0,
        },
      },
    },
    title: {
      text: 'Accuracy',
      color: '#1A1A1A',
      fontSize: 20,
      bold: true,
    },
    legend: { show: true, backgroundColor: '#F3F4F6', color: '#1A1A1A', fontSize: 12, bold: true },
    tooltip: {
      show: true,
      backgroundColor: '#F3F4F6',
      color: '#1A1A1A',
      fontSize: 14,
      roundingValue: 0,
      customFormat: null,
      showShape: true,
    },
  },
  userOptions: {
    show: true,
    title: 'options',
    labels: { useDiv: 'Title & legend inside', showTable: 'Show table' },
  },
  table: {
    show: false,
    responsiveBreakpoint: 400,
    th: { backgroundColor: '#F3F4F6', color: '#1A1A1A', outline: 'none' },
    td: {
      backgroundColor: '#F3F4F6',
      color: '#1A1A1A',
      outline: 'none',
      roundingValue: 2,
      roundingAverage: 1,
    },
    translations: {
      correlationCoefficient: 'Correlation Coef.',
      nbrPlots: 'Nbr plots',
      average: 'Average',
      series: 'Series',
    },
  },
}
</script>

<style scoped></style>
