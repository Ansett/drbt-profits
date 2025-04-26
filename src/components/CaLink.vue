<template>
  <span style="word-break: break-word">
    {{ name }}

    <span class="nowrap">
      <i
        v-if="!wallet"
        class="pi pi-external-link text-primary cursor-pointer ml-1 mr-1"
        aria-label="Open chart"
        v-tooltip.bottom="{
          value: 'Open chart',
          showDelay: 500,
        }"
        @click="openChart(ca)"
      ></i>

      <code
        :class="['text-color-secondary', 'hoverlink', { 'px-1': !wallet }]"
        aria-label="Copy to clipboard"
        v-tooltip.bottom="{
          value: 'Copy address to clipboard',
          showDelay: 500,
        }"
        @click="copyCA"
      >
        {{ truncatedCa }}</code
      >
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import vTooltip from 'primevue/tooltip'
import { DEFAULT_SCREENER_URL } from '@/constants'

const { ca, name, wallet, screenerUrl } = defineProps<{
  ca: string
  name?: string
  wallet?: boolean
  screenerUrl?: string
}>()

const truncatedCa = computed(() => ca.slice(0, 5) + '...' + ca.slice(-4))

const toast = useToast()
const copyCA = () => {
  navigator.clipboard.writeText(ca)
  toast.add({
    severity: 'success',
    summary: `Copied ${name ? name + ' ' : ''}address to clipboard: ` + ca,
    life: 3000,
  })
}

const validScreenerUrl = computed(() => {
  if (!screenerUrl) return DEFAULT_SCREENER_URL

  let url = screenerUrl
  if (url.slice(-1) !== '/') url += '/'
  if (!url.startsWith('https://') && !url.startsWith('http://')) url = 'https://' + url

  return url
})

const openChart = (ca: string) => {
  const win = window.open(validScreenerUrl.value + ca, '_blank', '')
  if (win) win.opener = null
}
</script>
