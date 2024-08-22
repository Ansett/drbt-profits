<!-- prettier-ignore -->
<template>
  <div class="relative">
    <ProgressSpinner
      v-if="loading"
      class="absolute top-50 left-50 spinner"
      :data-info="typeof loading === 'string' ? loading : ''"
    />
    <!-- FUNDS -->
    <div class="text-2xl flex gap-2 align-items-center white-space-nowrap">
      <InfoButton
        v-if="info"
        :text="`Final wallet worth, starting from 0.<ul><li>Buy calculations: Investing selected max bag or contract's max buy, minus tax, gas price (calculated from current+delta gwei) and, optionally, estimated slippage from on-chain data.</li><li>Sell calculations: ${SELL_GAS_PRICE} fixed gas price, ${SELL_TAX}% tax and, optinally, price impact, are removed from each sales.</li><li>Investment is counted as a loss if not reaching targets.</li><li>Each sale's date is guessed from sale MC vs. ATH MC ratio: on a 1 month 4m MC token, selling at 1m means selling after 1 week.</li></ul>`"
        direction="right"
      />
      Realized profit:
      <span class="font-bold text-primary">{{ finalETH }}</span>
      <span class="text-color-secondary text-lg"> ETH</span>
    </div>
    <!-- DRAWDOWN -->
    <div class="text-lg flex gap-2 align-items-center white-space-nowrap">
      <InfoButton
        v-if="info"
        :text="`<ul><li>Overall drawdown: the lowest the wallet has fallen to, starting from 0 ETH, during the whole period.<li>Worst drawdown: the lowest the wallet has fallen to if you began your strategy at the worst time during the selected period (${worstDrawdown[0]} in this case).<li>You need at the very least double the worst drawndown value your wallet to sustain the strategy.</li></ul>`"
        direction="right"
      />
      Drawdown:
      <span class="text-primary">{{ drawdown }}</span>
      <span class="text-color-secondary text-xs"> overall </span>
      <span class="font-bold text-primary">{{ worstDrawdown[1] }}</span>
      <span class="text-color-secondary text-xs"> at worst </span>
      <span v-if="!info && worstDrawdown[0]" class="text-color-secondary text-xs font-italic"> from {{ worstDrawdown[0] }}</span>
    </div>
    <!-- DRAWDOWN RATIO -->
    <div class="text-lg flex gap-2 align-items-center white-space-nowrap">
      <InfoButton
        v-if="info"
        :text="`Might help you to see if worst drawdown increases more than profits, and it stops being worth it`"
        direction="right"
      />
      <span class="">Profit/drawdown ratio: </span>
      <span class="text-primary">{{
        worstDrawdown[1]
          ? round(finalETH / Math.abs(worstDrawdown[1]), 2)
          : 0
      }}</span>
    </div>
    <!-- VOLUME -->
    <div class="text-lg flex gap-2 align-items-center white-space-nowrap">
      <InfoButton
        v-if="info"
        :text="`Total spent, including gas cost`"
        direction="right"
      />
      Volume:
      <span class="text-primary">{{ volume || 0 }}</span>
      <span class="text-color-secondary"> ETH</span>
    </div>
    <!-- VOLUME RATIO -->
    <div class="text-lg flex gap-2 align-items-center white-space-nowrap">
      <InfoButton
        v-if="info"
        :text="`Might help you to gauge spending efficiency`"
        direction="right"
      />
      <span class="">Profit/volume ratio: </span>
      <span class="text-primary">{{
        volume
          ? round(finalETH / volume, 2)
          : 0
      }}</span>
    </div>
    <!-- NB CALLS and stats -->
    <Accordion v-if="info" :activeIndex="fullStats ? 0 : null" lazy @update:activeIndex="statsAccordionToggle">
        <AccordionTab :pt="{
          headeraction: { class: 'border-none py-1 px-0' },
          content: { class: 'py-1 pl-3 border-y-none border-right-none border-left-1', style: 'margin-left: 7px' },
        }">
          <template #header>
            <div class="text-lg font-normal white-space-nowrap">Number of calls: <span class="text-primary">{{ nbCalls }}</span></div>
          </template>

            <div class="text-sm white-space-nowrap">
              Rugs: {{counters.rug}} ({{ statPercentages(counters.rug,nbCalls) }})
            </div>
            <div class="text-sm white-space-nowrap">
              100X+: {{counters.x100}} ({{ statPercentages(counters.x100,nbCalls) }})
            </div>
            <div class="text-sm white-space-nowrap">
              50X+: {{counters.x50}} ({{ statPercentages(counters.x50,nbCalls) }})
            </div>
            <div class="text-sm white-space-nowrap">
              20X+: {{counters.x20}} ({{ statPercentages(counters.x20,nbCalls) }})
            </div>
            <div class="text-sm white-space-nowrap">
              10X+: {{counters.x10}} ({{ statPercentages(counters.x10,nbCalls) }})
            </div>
            <div class="text-sm white-space-nowrap">
              5X+: {{counters.x5}} ({{ statPercentages(counters.x5,nbCalls) }})
            </div>
            <div class="text-sm white-space-nowrap">
              2X+: {{counters.x2}} ({{ statPercentages(counters.x2,nbCalls) }})
            </div>
            <div class="text-sm">
              PostATH: {{counters.postAth}} ({{ statPercentages(counters.postAth,nbCalls) }})
            </div>
            <div v-if="counters.unrealistic" class="text-sm white-space-nowrap">
              Unrealistic trades where we had to cap Xs: {{counters.unrealistic}} ({{ statPercentages(counters.unrealistic,nbCalls) }})
            </div>
        </AccordionTab>
    </Accordion>
    <!-- NB CALLS  -->
    <div v-else class="text-lg white-space-nowrap">Number of calls: <span class="text-primary">{{ nbCalls }}</span></div>

    <div v-if="noApiKey" class="font-italic text-sm text-yellow-300">
      (&hairsp;It's recommanded to provide an API key in order to fetch on-chain data for a more realistic slippage simulation&hairsp;)
    </div>
  </div>
</template>

<script setup lang="ts">
import ProgressSpinner from 'primevue/progressspinner'
import Accordion from 'primevue/accordion'
import AccordionTab from 'primevue/accordiontab'
import { SELL_GAS_PRICE, SELL_TAX } from '@/constants'
import type { ComputationResult } from '@/types/ComputationResult'
import { round } from '@/lib'
import InfoButton from './InfoButton.vue'

// eslint-disable-next-line unused-imports/no-unused-vars-ts
const props = defineProps<{
  nbCalls: number
  loading: boolean | string
  finalETH: number
  drawdown: number
  volume: number
  worstDrawdown: [string, number]
  counters: ComputationResult['counters']
  info?: boolean
  noApiKey?: boolean
  fullStats?: boolean
}>()
const emit = defineEmits<{
  (e: 'fullStats', param: boolean): void
}>()

const statPercentages = (counter: number, nbCalls: number): string => {
  const value = nbCalls ? round((counter / nbCalls) * 100, 2) : 0
  return value + '%'
}

const statsAccordionToggle = (index?: number | null) => {
  emit('fullStats', index !== null)
}
</script>

<style scoped>
.spinner {
  width: 99px;
  height: 99px;
  transform: translate(-50%, -50%);
  z-index: 1;
}

.spinner[data-info]:not([data-info=''])::after {
  content: attr(data-info);
  position: absolute;
  left: 50%;
  bottom: -32px;
  transform: translateX(-50%);
  font-size: 0.8rem;
  white-space: nowrap;
  background: var(--surface-a);
  color: var(--yellow-300);
  padding: 1rem;
  font-weight: bold;
  border-radius: 1rem;
  z-index: -1;
  opacity: 0.8;
}
</style>
