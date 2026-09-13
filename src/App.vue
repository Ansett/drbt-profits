<template>
  <header
    class="flex flex-row column-gap-3 row-gap-3 align-items-center mb-3 pt-2 pb-2 xl:pb-4 px-2 flex-wrap lg:justify-content-center"
  >
    <div
      class="flex-grow-0 flex-order-0 lg:flex-order-3 lg:w-full flex flex-row justify-content-left lg:justify-content-center"
    >
      <Menubar :model="submenu" class="lg:h-4rem" :pt="{ menu: { class: 'min-w-max' } }">
        <template #item="{ item, props }">
          <router-link v-slot="{ href, navigate }" :to="item.route" custom>
            <a
              :href="href"
              v-bind="props.action"
              :class="['no-underline', { 'text-primary': route.path === item.route }]"
              @click="navigate"
            >
              <span v-if="item.icon?.startsWith('pi')" :class="item.icon" />
              <span v-else-if="item.icon" class="material-symbols-outlined">{{ item.icon }}</span>
              <span class="ml-2">{{ item.label }}</span>
            </a>
          </router-link>
        </template>
      </Menubar>
    </div>

    <h1
      class="m-0 text-xs sm:text-xl lg:text-4xl text-color-secondary flex-grow-0 flex-order-1 lg:flex-order-0 text-left lg:text-center flex flex-column sm:flex-row align-items-center mb-3 sm:mb-0"
    >
      <span>
        <a href="https://t.me/DeFi_Robot_Portal" style="color: inherit" target="_blank">DRBT</a>
        profits on
      </span>
      <Dropdown
        v-model="selectedChain"
        :options="chains"
        variant="outlined"
        optionLabel="label"
        optionValue="path"
        class="route-dropdown"
      >
        <template #value="{ value }">
          <span class="flex align-items-center">
            <BrandIcon :brand="brandOf(value)" />
            <span class="ml-2">{{ chainLabel(value) }}</span>
          </span>
        </template>
        <template #option="{ option }">
          <span class="flex align-items-center">
            <BrandIcon :brand="option.brand" />
            <span class="ml-2">{{ option.label }}</span>
          </span>
        </template>
      </Dropdown>
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
    The application moved back to
    <a href="https://drbt-profits.ansett.xyz">drbt-profits.ansett.xyz</a>
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
import Dropdown from 'primevue/dropdown'
import Menubar from 'primevue/menubar'
import CaLink from './components/CaLink.vue'
import BrandIcon from './components/BrandIcon.vue'

type ChainId = 'rh' | 'sol' | 'eth'

const redirect = computed<boolean>(() => window.location.hostname === 'drbt-profits.onrender.com')
const oldHost = computed<boolean>(() => !!window.location.hostname.match(/drbt-?tools/))
const showDonation = ref(false)

const route = useRoute()
const router = useRouter()

const chains = [
  { label: 'Robinhood', path: '/rh', brand: 'rh' as const },
  { label: 'Solana', path: '/sol', brand: 'sol' as const },
  { label: 'Ethereum', path: '/eth', brand: 'eth' as const },
]

function chainOf(path: string): ChainId {
  if (path.startsWith('/sol')) return 'sol'
  if (path.startsWith('/eth')) return 'eth'
  return 'rh'
}

function brandOf(path: string | null | undefined): ChainId {
  return chainOf(path || '/rh')
}

function chainLabel(path: string | null | undefined) {
  return chains.find(c => c.path === path)?.label ?? ''
}

function pageOf(path: string): 'simulations' | 'match' {
  return /\/match(?:\/|$)/.test(path) ? 'match' : 'simulations'
}

const selectedChain = computed({
  get: () => `/${chainOf(route.path)}`,
  set: (chainPath: string) => {
    const page = pageOf(route.path)
    router.push(
      chainPath === '/eth' && page === 'match' ? '/eth/simulations' : `${chainPath}/${page}`,
    )
  },
})

const submenu = computed(() => {
  const chain = chainOf(route.path)
  const items = [
    {
      label: 'Simulations',
      icon: 'ssid_chart',
      route: `/${chain}/simulations`,
    },
  ]
  if (chain !== 'eth') {
    items.push({
      label: 'Token match',
      icon: 'poker_chip',
      route: `/${chain}/match`,
    })
  }
  return items
})
</script>

<style scoped>
.route-dropdown {
  vertical-align: middle;
  font-size: 1rem;
  font-weight: bold;
  margin-left: 1rem;
}
.route-dropdown :deep(.p-dropdown-label) {
  padding: 0.75rem 0rem 0.75rem 1rem;
  color: var(--text-color-secondary);
}
@media screen and (max-width: 991px) {
  .route-dropdown {
    margin-left: 0.5rem;
  }
  .route-dropdown :deep(.p-dropdown-label) {
    padding: 0.25rem 0rem 0.25rem 0.5rem;
  }
}
</style>
