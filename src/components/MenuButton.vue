<!-- prettier-ignore -->
<template>
  <Button
                icon="pi pi-ellipsis-v"
                aria-label="Actions"
                text
                size="small"
                aria-haspopup="true" aria-controls="overlay_menu" 
                class="p-1 w-min"
                @click="($refs.menu as any).toggle($event)"
              />
              <Menu ref="menu" id="overlay_menu" :model="actions" :popup="true" />
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Menu from 'primevue/menu'

// eslint-disable-next-line unused-imports/no-unused-vars-ts
const { actions } = defineProps<{
  actions: { label: string; icon: string; command: () => void }[]
}>()
</script>
