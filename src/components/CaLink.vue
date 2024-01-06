<template>
  <span>
    <a
      :class="[
        gray ? 'text-color-secondary' : 'text-color',
        'hoverlink',
        { 'text-xs': small },
      ]"
      target="_blank"
      rel="noopener"
      :href="'https://dexscreener.com/ethereum/' + ca"
    >
      {{ ca }}</a
    >
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  ca: string;
  gray?: boolean;
  small?: boolean;
}>();
</script>
