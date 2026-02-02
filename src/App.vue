<template>
  <header
    class="flex flex-row column-gap-3 row-gap-3 align-items-center mb-3 pt-2 pb-2 lg:pb-4 px-2 flex-wrap"
  >
    <div
      class="flex-grow-0 flex-order-0 lg:flex-order-3 lg:w-full flex flex-row justify-content-left lg:justify-content-center"
    >
      <Menubar :model="menu" class="lg:h-4rem" :pt="{ menu: { class: 'min-w-max' } }">
        <template #item="{ item, props }">
          <router-link v-slot="{ href, navigate }" :to="item.route" custom>
            <a
              :href="href"
              v-bind="props.action"
              :class="['no-underline', { 'text-primary': route.path === item.route }]"
              @click="navigate"
            >
              <span v-if="item.icon!.startsWith('pi')" :class="item.icon" />
              <span v-else class="material-symbols-outlined">{{ item.icon }}</span>
              <span class="ml-2">{{ item.label }}</span>
            </a>
          </router-link>
        </template>
      </Menubar>
    </div>

    <h1
      class="m-0 text-xl lg:text-4xl text-color-secondary flex-grow-1 flex-order-1 lg:flex-order-0 text-left lg:text-center"
    >
      <a href="https://t.me/DeFi_Robot_Portal" style="color: inherit" target="_blank">DRBT</a>
      tools
    </h1>

    <Button
      icon="pi pi-heart-fill"
      aria-label="Donate"
      outlined
      rounded
      class="w-2rem h-2rem lg:w-3rem lg:h-3rem absolute top-0 right-0 mt-5 mr-3 lg:mt-4"
      @click="showDonation = true"
    />
  </header>

  <div v-if="redirect" class="text-center xl:text-left ml-0 xl:ml-6 mr-7 xl:mr-0 pl-0 xl:pl-1">
    The application moved to <a href="https://drbt-tools.ansett.xyz">drbt-tools.ansett.xyz</a>
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
        <CaLink ca="0xCDce65EC034F058b6cC7428275e9BA9f356269fd" type="wallet" />
        (Ethereum, Polygon, Base)
      </li>
      <li>
        <CaLink ca="3yTeS4b5BcwMNBdxL2w1cysFDrUPcT21ZvQHpwErJLrL" type="wallet" />
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
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Menubar from 'primevue/menubar'
import CaLink from './components/CaLink.vue'

const redirect = computed<boolean>(() => window.location.hostname === 'drbt-profits.onrender.com')
const showDonation = ref(false)

const route = useRoute()

const menu = [
  {
    label: 'SOL profits',
    icon: 'electric_bolt',
    route: '/sol',
  },
  // {
  //   label: 'SOL token match',
  //   icon: 'poker_chip',
  //   route: '/token-sol',
  // },
  {
    label: 'ETH profits',
    icon: 'pi pi-ethereum',
    route: '/eth',
  },
]
</script>

<style scoped></style>
