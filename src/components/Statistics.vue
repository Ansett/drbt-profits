<!-- prettier-ignore -->
<template>
  <div class="flex flex-column align-items-start relative">
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
                <span v-if="!info" class="text-color-secondary text-xs font-italic"> from {{ worstDrawdown[0] }}</span>
              </div>
              <!-- RATIO -->
              <div class="text-lg flex gap-2 align-items-center white-space-nowrap">
                <InfoButton
                v-if="info"
                  :text="`Might help you to see if drawdown increases more than profits, and it stops being worth it`"
                  direction="right"
                />
                <span class="">Profit/drawdown ratio: </span>
                <span class="text-primary">{{
                  worstDrawdown[1]
                    ? round(finalETH / Math.abs(worstDrawdown[1]), 2)
                    : 0
                }}</span>
              </div>
              <!-- NB CALLS -->
              <div class="text-lg flex gap-2 align-items-center white-space-nowrap">
                <InfoButton
                v-if="info"
                  :text="`Including<ul>${
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
                  } calls that made 10x</li></ul>`"
                  direction="right"
                />
                <span class="">Number of calls: </span>
                <span class="text-primary">{{ nbCalls }}</span>
              </div>
              <div v-if="noApiKey" class="font-italic text-sm text-yellow-500">
                (&hairsp;It's recommanded to provide an API key in order to fetch on-chain data for a more realistic slippage simulation&hairsp;)
              </div>
            </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ProgressSpinner from 'primevue/progressspinner'
import { ETH_PRICE, SELL_GAS_PRICE, SELL_TAX } from '@/constants'
import type { ComputationResult } from '@/types/ComputationResult'
import type { Call } from '@/types/Call'
import { round } from '@/lib'
import InfoButton from './InfoButton.vue'

// eslint-disable-next-line unused-imports/no-unused-vars-ts
const props = defineProps<{
  nbCalls: number
  loading: boolean | string
  finalETH: number
  drawdown: number
  worstDrawdown: [string, number]
  counters: ComputationResult['counters']
  info?: boolean
  noApiKey?: boolean
}>()
</script>

<style scoped>
.spinner {
  width: 99px;
  height: 99px;
  transform: translate(-50%, -50%);
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
  padding: 1rem;
  font-weight: bold;
  border-radius: 1rem;
  z-index: -1;
  opacity: 0.8;
}
</style>
