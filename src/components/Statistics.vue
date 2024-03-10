<!-- prettier-ignore -->
<template>
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
              <div class="text-2xl flex gap-2 align-items-center white-space-nowrap">
                <InfoButton
                v-if="info"
                  :text="`Final wallet worth, starting from 0.<ul><li>Buy calculations: Investing selected max bag or contract's max buy, calculated using $${ETH_PRICE} ETH value, minus tax and gas price (calculated from current+delta gwei).</li><li>Sell calculations: ${SELL_GAS_PRICE} fixed gas price and ${SELL_TAX}% tax are removed from each sales.</li><li>Investment is counted as a loss if not reaching targets.</li></ul>`"
                  direction="right"
                />
                Realized profits:
                <span class="font-bold text-primary">{{ finalETH }}</span>
                <span class="text-color-secondary text-lg"> ETH</span>
              </div>
              <!-- DRAWDOWN -->
              <div class="text-lg flex gap-2 align-items-center white-space-nowrap">
                <InfoButton
                v-if="info"
                  text="The lowest the wallet has fallen to, starting from 0 ETH, during the whole period"
                  direction="right"
                />
                Overall drawdown:
                <span class="font-bold text-primary">{{ drawdown }}</span>
                <span class="text-color-secondary text-xs"> ETH</span>
              </div>
              <div class="text-lg flex gap-2 align-items-center white-space-nowrap">
                <InfoButton
                v-if="info"
                  :text="`The lowest the wallet has fallen to, starting from 0 ETH, if you began your strategy at the worst time during the selected period${
                    worstDrawdown[0]
                      ? ` (${worstDrawdown[0]} in this case)`
                      : ''
                  }.<br>You need at least double this value in your wallet to sustain the strategy.<br>Sale is counted the same day as buy because we don't know better, but in reality it can happen weeks later, which makes your drawdown even bigger.</li>`"
                  direction="right"
                />
                Worst drawdown:
                <span class="font-bold text-primary">{{
                  worstDrawdown[1]
                }}</span>
                <span class="text-color-secondary text-xs"> ETH </span>
                <span v-if="!info" class="text-color-secondary text-xs font-italic"> from {{ worstDrawdown[0] }}</span>
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
            </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import ProgressSpinner from "primevue/progressspinner";
import { ETH_PRICE, SELL_GAS_PRICE, SELL_TAX } from "@/constants";
import type { ComputationResult } from "@/types/ComputationResult";
import type { Call } from "@/types/Call";
import { round } from "@/lib";
import InfoButton from "./InfoButton.vue";

// eslint-disable-next-line unused-imports/no-unused-vars-ts
const props = defineProps<{
  nbCalls: number;
  loading: boolean;
  finalETH: number;
  drawdown: number;
  worstDrawdown: [string, number];
  counters: ComputationResult["counters"];
  info?: boolean;
}>();
</script>
