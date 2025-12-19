<template>
  <main>
    <div class="w-full max-w-full px-2">
      <Accordion :activeIndex="[0]" multiple class="mt-5">
        <AccordionTab
          header="MOONERS"
          :pt="{
            headerAction: { style: 'text-decoration: none !important' },
          }"
        >
          <template #header>
            <Button
              label="Copy"
              severity="primary"
              outlined
              class="small-button ml-5"
              @click.stop="copyMooners"
            />
          </template>

          <div class="flex flex-column xl:flex-row gap-4">
            <!-- New/Both Mooners -->
            <DataTable :value="newAndBothMooners" dataKey="ca" size="small" class="flex-1">
              <template #header>
                <div class="text-sm font-semibold">New & Updated Mooners</div>
              </template>
              <template #empty> No new mooners </template>
              <Column
                field="ca"
                header="CA"
                :pt="{
                  headerTitle: { class: 'text-xs' },
                }"
              >
                <template #body="{ data }">
                  <CaLink :name="data.name" :ca="data.ca" :screener-url="screenerUrl" />
                </template>
              </Column>
              <Column field="xs" header="XS" :pt="{ headerTitle: { class: 'text-xs' } }">
                <template #body="{ data }">
                  <span :class="data.type === 'new' ? 'text-green-500' : ''">
                    {{ data.xs }}
                  </span>
                </template>
              </Column>
            </DataTable>

            <!-- Old Mooners -->
            <DataTable :value="oldOnlyMooners" dataKey="ca" size="small" class="flex-1">
              <template #header>
                <div class="text-sm font-semibold">Removed Mooners</div>
              </template>
              <template #empty> No removed mooners </template>
              <Column field="ca" header="CA" :pt="{ headerTitle: { class: 'text-xs' } }">
                <template #body="{ data }">
                  <CaLink :name="data.name" :ca="data.ca" :screener-url="screenerUrl" />
                </template>
              </Column>
              <Column field="xs" header="XS" :pt="{ headerTitle: { class: 'text-xs' } }">
                <template #body="{ data }">
                  <span class="text-red-500">
                    {{ data.xs }}
                  </span>
                </template>
              </Column>
            </DataTable>
          </div>
        </AccordionTab>
      </Accordion>
    </div>

    <!-- Wallets -->
    <div class="w-full max-w-full px-2">
      <Accordion :activeIndex="[0]" multiple class="mt-5">
        <AccordionTab
          header="WALLETS"
          :pt="{
            headerAction: { style: 'text-decoration: none !important' },
          }"
        >
          <template #header>
            <div class="flex flex-row gap-4 w-full">
              <Button
                label="Clear"
                severity="primary"
                outlined
                class="small-button ml-5"
                @click.stop="newWallets = []"
              />

              <InputText
                v-model="resultsInput"
                placeholder="Partial dashboard results"
                class="flex-grow-1"
                @click.stop
              />
            </div>
          </template>

          <!-- Wallets diff -->
          <DataTable :value="walletsDiff" dataKey="adr" size="small" class="flex-1">
            <template #empty> No wallets </template>
            <Column field="adr" header="ADDRESS" :pt="{ headerTitle: { class: 'text-xs' } }">
              <template #body="{ data }">
                <CaLink type="wallet" :ca="data.wallet.adr" />
                &nbsp;
                <i
                  class="pi pi-external-link text-primary cursor-pointer ml-1 mr-1"
                  aria-label="Open GMGN"
                  v-tooltip.bottom="{
                    value: 'Open GMGN',
                    showDelay: 500,
                  }"
                  @click="openGmGn(data.wallet.adr)"
                ></i>
              </template>
            </Column>
            <!-- Mooner -->
            <Column field="mooners" header="MOONERS" :pt="{ headerTitle: { class: 'text-xs' } }">
              <template #body="{ data }">
                <span
                  :class="{
                    'text-green-500': data.type === 'new',
                    'text-red-500': data.type === 'old',
                  }"
                  ><span class="text-color-secondary">
                    {{
                      data.type === 'both' &&
                      data.oldMooners &&
                      data.oldMooners !== data.wallet.mooners
                        ? data.oldMooners + (data.oldMooners < data.wallet.mooners ? ' < ' : ' > ')
                        : ''
                    }}</span
                  >
                  {{ data.wallet.mooners }}
                </span>
              </template>
            </Column>
            <!-- Tokens total and ratio -->
            <Column field="total" header="TOTAL" :pt="{ headerTitle: { class: 'text-xs' } }">
              <template #body="{ data }">
                <span :class="{ 'text-300': !isRatioOk(data) }">
                  {{ data.wallet.total }} ({{
                    round((data.wallet.mooners / data.wallet.total) * 100)
                  }}%)
                </span>
              </template>
            </Column>
            <!-- Wallet age and last tx -->
            <Column field="age" header="AGE" :pt="{ headerTitle: { class: 'text-xs' } }">
              <template #body="{ data }">
                <span :class="['white-space-nowrap', { 'text-300': !isAgeOk(data) }]">
                  {{ data.wallet.age }} / {{ data.wallet.last }}
                </span>
              </template>
            </Column>
            <!-- Backtest stats -->
            <Column header="STATS" :pt="{ headerTitle: { class: 'text-xs' } }">
              <template #body="{ data }">
                <div class="flex flex-row gap-3">
                  <span class="white-space-nowrap">{{ data.oldStats || '&nbsp;' }}</span>
                  <InputText
                    v-if="data.type !== 'old'"
                    v-model="data.wallet.stats"
                    :class="[
                      'w-full p-1',
                      { 'border-yellow-400': isRatioOk(data) && isAgeOk(data) },
                    ]"
                  />
                </div>
              </template>
            </Column>
            <!-- Selection -->
            <Column :header="selectionHeader" :pt="{ headerTitle: { class: 'text-xs' } }">
              <template #body="{ data }">
                <div class="flex flex-row gap-3">
                  <span class="white-space-nowrap">{{ data.oldIncluded || '&nbsp;' }}</span>
                  <InputText
                    v-if="data.type !== 'old'"
                    v-model="data.wallet.included"
                    :class="['w-full p-1', { 'border-yellow-400': areStatsGood(data) }]"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
        </AccordionTab>
      </Accordion>
    </div>

    <div class="mt-4 text-center">
      <Button label="Save" severity="primary" @click="save" />
    </div>

    <Toast />
  </main>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted, shallowRef } from 'vue'
import Accordion from 'primevue/accordion'
import AccordionTab from 'primevue/accordiontab'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Button from 'primevue/button'
import vTooltip from 'primevue/tooltip'
import InputText from 'primevue/inputtext'
import FileUpload, { type FileUploadSelectEvent } from 'primevue/fileupload'
import ProgressSpinner from 'primevue/progressspinner'
import Toast from 'primevue/toast'
import CaLink from './components/CaLink.vue'
import { STORAGE_KEY } from './storage'
import { DEFAULT_SOL_SCREENER_URL } from './constants'
import { round } from './lib'

type Mooner = { ca: string; name: string; xs: number }
type Wallet = {
  adr: string
  hits: number
  mooners: number
  total: number
  age: number
  last: number
  stats: string
  included: string
}
type WalletWithInfo = {
  wallet: Wallet
  type: 'old' | 'new' | 'both'
  oldMooners?: number
  oldStats?: string
  oldIncluded?: string
}

const oldMooners = ref<Mooner[]>([])
const newMooners = ref<Mooner[]>([])
try {
  newMooners.value = JSON.parse(localStorage.getItem(STORAGE_KEY.MOONERS_NEW) || '[]')
} catch (e) {
  console.error(`Failed to parse ${STORAGE_KEY.MOONERS_NEW} storage data:`, e)
}
try {
  oldMooners.value = JSON.parse(localStorage.getItem(STORAGE_KEY.MOONERS_OLD) || '[]')
} catch (e) {
  console.error(`Failed to parse ${STORAGE_KEY.MOONERS_OLD} storage data:`, e)
}

const moonersDiff = computed(() => [
  ...newMooners.value.map(m => ({
    ...m,
    type: !oldMooners.value.some(old => old.ca === m.ca) ? 'new' : 'both',
  })),
  ...oldMooners.value
    .filter(m => !newMooners.value.some(old => old.ca === m.ca))
    .map(m => ({ ...m, type: 'old' })),
])
const newAndBothMooners = computed(() =>
  moonersDiff.value.filter(m => m.type === 'new' || m.type === 'both'),
)
const oldOnlyMooners = computed(() => moonersDiff.value.filter(m => m.type === 'old'))

const screenerUrl = computed<string>(() => DEFAULT_SOL_SCREENER_URL)

const copyMooners = () => {
  const caList = newMooners.value.map(mooner => mooner.ca).join(',')
  navigator.clipboard.writeText(caList)
}

const resultsInput = ref<string | undefined>('')
const newWallets = ref<Wallet[]>([])
const oldWallets = ref<Wallet[]>([])
try {
  oldWallets.value = JSON.parse(localStorage.getItem(STORAGE_KEY.WALLETS_OLD) || '[]')
} catch (e) {
  console.error(`Failed to parse ${STORAGE_KEY.WALLETS_OLD} storage data:`, e)
}

const walletsDiff = computed<WalletWithInfo[]>(() => {
  const result: WalletWithInfo[] = []
  if (!newWallets.value.length) return result

  // New wallets (not in old)
  result.push(
    ...newWallets.value
      .filter(w => !oldWallets.value.some(old => old.adr === w.adr))
      .map(w => ({
        wallet: w,
        type: 'new' as const,
        oldMooners: 0,
        oldStats: '',
        oldIncluded: '',
      })),
  )

  // Old wallets (not in new)
  result.push(
    ...oldWallets.value
      .filter(w => !newWallets.value.some(newW => newW.adr === w.adr))
      .map(w => ({
        wallet: w,
        type: 'old' as const,
        oldMooners: w.mooners || 0,
        oldStats: w.stats || '',
        oldIncluded: w.included || '',
      })),
  )

  // Wallets present in both
  result.push(
    ...newWallets.value
      .filter(w => oldWallets.value.some(old => old.adr === w.adr))
      .map(w => {
        const oldWallet = oldWallets.value.find(old => old.adr === w.adr)
        return {
          wallet: w,
          type: 'both' as const,
          oldMooners: oldWallet?.mooners || 0,
          oldStats: oldWallet?.stats || '',
          oldIncluded: oldWallet?.included || '',
        } as WalletWithInfo
      }),
  )

  return result.sort((a, b) => b.wallet.mooners - a.wallet.mooners)
})

const selectionHeader = computed(
  () =>
    `SELECTION (${oldWallets.value.reduce(
      (sum, w) => sum + (w.included ? 1 : 0),
      0,
    )} -> ${newWallets.value.reduce((sum, w) => sum + (w.included ? 1 : 0), 0)})`,
)

const openGmGn = (adr: string) => {
  const win = window.open('https://gmgn.ai/sol/address/' + adr, '_blank', '')
  if (win) win.opener = null
}

const isRatioOk = (wallet: WalletWithInfo): boolean =>
  wallet.wallet.total < 90000 && wallet.wallet.mooners / wallet.wallet.total > 0.0003
const isAgeOk = (wallet: WalletWithInfo): boolean =>
  wallet.wallet.age > 30 && wallet.wallet.last < 4
const areStatsGood = (wallet: WalletWithInfo): boolean => {
  if (!wallet.wallet.stats.match(/100x/i)) return false
  const rate = wallet.wallet.stats.match(/(\d+\.\d+)%/)?.[1]
  return !!rate && Number(rate) > 0.70
}

// add pasted wallets
watch(resultsInput, async result => {
  if (!result?.trim()) return

  const regex = /([A-Za-z0-9]{44})[\r\n\s]*(\d+)[\r\n\s]*(\d+)[\r\n\s]*(\d+)[\r\n\s]*(\d+)/g
  let match
  while ((match = regex.exec(result)) !== null) {
    const address = match[1]
    const moonersToAdd = Number(match[2])

    const existingWallet = newWallets.value.find(w => w.adr === address)
    if (existingWallet) {
      existingWallet.hits += 1
      existingWallet.mooners += moonersToAdd
    } else {
      newWallets.value.push({
        adr: address,
        mooners: moonersToAdd,
        total: Number(match[3]),
        age: Number(match[4]),
        last: Number(match[5]),
        stats: '',
        included: '',
        hits: 1,
      })
    }
  }
  await nextTick()
  resultsInput.value = ''
})

const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY.MOONERS_OLD, JSON.stringify(newMooners.value))
    localStorage.setItem(STORAGE_KEY.WALLETS_OLD, JSON.stringify(newWallets.value))

    const dataToExport = {
      'mooners-old': newMooners.value,
      'wallets-old': newWallets.value,
    }

    const jsonString = JSON.stringify(dataToExport, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `alpha-wallets-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Failed to save data:', error)
  }
}
</script>
