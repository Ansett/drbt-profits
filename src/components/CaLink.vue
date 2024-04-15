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
import { computed } from "vue";
import { useToast } from "primevue/usetoast";
import vTooltip from "primevue/tooltip";

const props = defineProps<{
  ca: string;
  name?: string;
  wallet?: boolean;
}>();

const truncatedCa = computed(
  () => props.ca.slice(0, 5) + "..." + props.ca.slice(-4)
);

const toast = useToast();
const copyCA = () => {
  navigator.clipboard.writeText(props.ca);
  toast.add({
    severity: "success",
    summary:
      `Copied ${props.name ? props.name + " " : ""}address to clipboard: ` +
      props.ca,
    life: 3000,
  });
};

const openChart = (ca: string) => {
  const win = window.open(
    "https://dexscreener.com/ethereum/" + ca,
    "_blank",
    ""
  );
  if (win) win.opener = null;
};
</script>
