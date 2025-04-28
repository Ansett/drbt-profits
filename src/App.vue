<template>
  <header
    class="text-xl md:text-3xl lg:text-4xl xl:text-5xl font-light text-color-secondary text-center xl:text-left my-2 ml-0 xl:ml-6 flex flex-row align-items-center"
  >
    <div class="flex-auto flex flex-row column-gap-3 align-items-center flex-wrap title">
      <span>Backtesting</span>
      <Dropdown
        v-model="selectedRoute"
        :options="routes"
        optionLabel="label"
        optionValue="path"
        @change="onRouteChange"
        class="route-dropdown w-28"
      />
      <span
        >profits from
        <a href="https://t.me/DeFi_Robot_Portal" style="color: inherit" target="_blank"
          >DRBT</a
        ></span
      >
    </div>

    <Button
      icon="pi pi-heart-fill"
      aria-label="Donate"
      outlined
      rounded
      class="w-2rem h-2rem md:w-3rem md:h-3rem mx-1 md:mx-2 xl:mx-4 flex-shrink-0"
      @click="showDonation = true"
    />
  </header>

  <div v-if="redirect" class="text-center xl:text-left ml-0 xl:ml-6 mr-7 xl:mr-0 pl-0 xl:pl-1">
    The application moved to <a href="https://drbt-profits.ansett.xyz">drbt-profits.ansett.xyz</a>
  </div>

  <RouterView v-else />

  <Dialog
    v-model:visible="showDonation"
    modal
    dismissableMask
    :style="{
      maxWidth: '80%',
      width: '36rem',
    }"
  >
    <template #header>&nbsp;</template>
    <p>
      If you want to donate anything so I can invest more time to improve the tool, I'll gladly
      accept transfers to:
    </p>
    <ul class="bullets">
      <li>
        <CaLink ca="0xCDce65EC034F058b6cC7428275e9BA9f356269fd" wallet />
        (Ethereum, Polygon, Base)
      </li>
      <li>
        <CaLink ca="3yTeS4b5BcwMNBdxL2w1cysFDrUPcT21ZvQHpwErJLrL" wallet />
        (Solana)
      </li>
    </ul>
    <p class="mt-3">Thanks wholeheartedly :D</p>
  </Dialog>
</template>

<script setup lang="ts">
// https://v3.primevue.org/dropdown
// https://primeflex.org/flexdirection
// https://fonts.google.com/icons?selected=Material+Symbols+Outlined:thumb_up:FILL@0;wght@400;GRAD@0;opsz@24&icon.set=Material+Symbols&icon.style=Outlined
import { watch, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import Dialog from 'primevue/dialog'
import CaLink from './components/CaLink.vue'

const redirect = computed<boolean>(() => window.location.hostname === 'drbt-profits.onrender.com')
const showDonation = ref(false)

const route = useRoute()
const router = useRouter()
const routes = [
  { label: 'Ethereum', path: '/eth' },
  { label: 'Solana', path: '/sol' },
]
const selectedRoute = ref(route.path)
watch(route, () => {
  selectedRoute.value = route.path
})
function onRouteChange() {
  if (selectedRoute.value !== route.path) {
    router.push(selectedRoute.value)
  }
}
</script>

<style scoped>
.route-dropdown {
  order: 2;
  margin-top: 0.5rem;
}
.route-dropdown > * {
  height: 3rem;
}

.title *:first-child {
  order: 1;
}
.title *:last-child {
  order: 3;
}
@media (max-width: 767px) {
  .route-dropdown {
    order: 4;
    margin-top: 0;
  }
  .route-dropdown > * {
    height: 2.5rem;
    line-height: 1;
  }
}
</style>
