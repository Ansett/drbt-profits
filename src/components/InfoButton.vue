<!-- prettier-ignore -->
<template>
  <i
    class="pi pi-info-circle cursor-pointer"
    :style="{ fontSize: '1rem', color: accent ? 'var(--cyan-300)' : '' }"
    v-tooltip:[options]="{ value: text, escape: false }"
    :key="options.position"
    tabindex="0"
    @click.prevent.stop
  ></i>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import vTooltip from 'primevue/tooltip'

// eslint-disable-next-line unused-imports/no-unused-vars-ts
const props = defineProps<{
  text: string
  accent?: boolean
  direction?: 'left' | 'right' | 'top' | 'bottom'
  hover?: boolean
}>()

const options = computed(() => ({
  position: props.direction || 'bottom',
  event: props.hover ? 'hover' : 'focus',
}))
</script>
