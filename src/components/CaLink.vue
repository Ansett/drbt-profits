<template>
  <span>
    {{ name }}
    <i
      class="pi pi-copy text-primary cursor-pointer ml-1 mr-1"
      aria-label="Copy to clipboard"
      v-tooltip="'Copy CA to clipboard'"
      @click="copyCA"
    ></i>

    <a
      :class="['text-color-secondary', 'hoverlink']"
      target="_blank"
      rel="noopener"
      :href="'https://dexscreener.com/ethereum/' + ca"
    >
      {{ truncatedCa }}</a
    >
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useToast } from "primevue/usetoast";
import vTooltip from "primevue/tooltip";

const props = defineProps<{
  ca: string;
  name: string;
}>();

const truncatedCa = computed(
  () => props.ca.slice(0, 5) + "..." + props.ca.slice(-4)
);

const toast = useToast();
const copyCA = () => {
  navigator.clipboard.writeText(props.ca);
  toast.add({
    severity: "success",
    summary: "Copied CA to clipboard: " + props.ca,
    life: 3000,
  });
};
</script>
