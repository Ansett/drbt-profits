<template>
  <div class="flex flex-column align-items-start relative">
    <ul class="px-2">
      <li v-for="line in lines" :key="line.id" class="text-sm mb-2">
        <span class="text-color-secondary">[</span>
        <code>{{ line.id }}</code>
        <span class="text-color-secondary">] </span>
        <i
          class="text-color-secondary pi pi-bell ml-1"
          style="font-size: 0.8rem"
          v-tooltip.top="'Number of calls'"
        ></i
        >&nbsp;<span class="link" @click="inspectedHash = line">
          {{ line.allCalls.length }}
        </span>
        <i
          class="text-color-secondary pi pi-sort ml-1"
          style="font-size: 0.8rem"
          v-tooltip.top="'Xs average'"
        ></i>
        {{ Math.round(line.xSum / line.allCalls.length) }}
        <i
          class="text-color-secondary pi pi-thumbs-up ml-1"
          style="font-size: 0.8rem"
          v-tooltip.top="'10x count and %'"
        ></i>
        {{ line.x10Calls.length }} ({{
          Math.round((line.x10Calls.length / line.allCalls.length) * 100) + "%"
        }})
        <i
          class="text-color-secondary pi pi-thumbs-up-fill ml-1"
          style="font-size: 0.8rem"
          v-tooltip.top="'50x count and %'"
        ></i>
        {{ line.x50Calls.length }} ({{
          Math.round((line.x50Calls.length / line.allCalls.length) * 100) + "%"
        }})
        <i
          class="text-color-secondary pi pi-thumbs-down ml-1"
          style="font-size: 0.8rem"
          v-tooltip.top="'Rugs count and %'"
        ></i>
        {{ line.rugs }} ({{
          Math.round((line.rugs / line.allCalls.length) * 100) + "%"
        }})
        <i
          class="link pi pi-tags ml-1"
          style="font-size: 0.8rem"
          v-tooltip.top="'Add a tag'"
          @click="showTagInput(line.id, $event)"
        ></i>
        <span v-for="(tag, index) in line.tags" :key="index"
          >{{ index ? ", " : " "
          }}<span class="link" @click="removeTag(line.id, index)">{{
            tag
          }}</span></span
        >
      </li>
    </ul>

    <!-- Hash calls popup -->
    <Sidebar
      :visible="!!inspectedHash"
      position="right"
      :header="`Calls with hash or sig ${inspectedHash?.id}`"
      class="w-full md:w-30rem"
      @update:visible="inspectedHash = null"
      @hide="inspectedHash = null"
    >
      <ul v-if="inspectedHash" class="px-2">
        <li
          v-for="call in inspectedHash.allCalls"
          :key="call.ca"
          class="text-sm mb-3"
        >
          <a
            class="text-color-secondary hoverlink"
            target="_blank"
            rel="noopener"
            :href="'https://dexscreener.com/ethereum/' + call.ca"
          >
            {{ call.ca }}</a
          >
          <br />
          {{ call.name }}:&nbsp; {{ call.xs }}x
          <span class="text-color-secondary"> {{ prettifyMc(call.ath) }}</span>
          <span v-if="call.rug"> [RUG] </span>
        </li>
      </ul>
    </Sidebar>

    <!-- Tag input -->
    <OverlayPanel ref="tagDropdown">
      <InputGroup>
        <InputGroupAddon>
          <i class="pi pi-tags"></i>
        </InputGroupAddon>
        <InputText
          ref="tagInput"
          type="text"
          v-model="newTag"
          @keyup.enter.native="addTag()"
        />
        <InputGroupAddon>
          <i class="pi pi-reply rotated"></i>
        </InputGroupAddon>
      </InputGroup>
    </OverlayPanel>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import type { HashInfo } from "../types/HashInfo";
import Sidebar from "primevue/sidebar";
import OverlayPanel from "primevue/overlaypanel";
import InputGroup from "primevue/inputgroup";
import InputGroupAddon from "primevue/inputgroupaddon";
import InputText from "primevue/inputtext";
import vTooltip from "primevue/tooltip";
import { prettifyMc } from "../lib";

const TAG_SEPARATOR = ", ";

const props = defineProps<{
  lines: HashInfo[];
}>();
const emit = defineEmits<{
  (e: "removeTag", hash: string, index: number): void;
  (e: "addTag", hash: string, tag: string): void;
}>();

const inspectedHash = ref<HashInfo | null>(null);
const tagDropdown = ref<InstanceType<typeof OverlayPanel>>();
const tagInput = ref();
const newTag = ref("");
const editingForHash = ref("");

const removeTag = (hash: string, index: number) =>
  emit("removeTag", hash, index);
const showTagInput = async (hash: string, event: MouseEvent) => {
  editingForHash.value = hash;
  newTag.value = "";
  tagDropdown.value?.show(event);
  await nextTick();
  tagInput.value?.$el.focus();
};
const addTag = () => {
  tagDropdown.value?.hide();
  if (!editingForHash.value) return;
  emit(
    "addTag",
    editingForHash.value,
    newTag.value.trim().replace(TAG_SEPARATOR.trim(), "")
  );
  newTag.value = "";
  editingForHash.value = "";
};
</script>

<style scoped>
.rotated {
  transform: rotate(-0.5turn);
}
</style>
