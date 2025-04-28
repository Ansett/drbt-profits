<!-- prettier-ignore -->
<template>
   <div
          v-for="(takeProfit, index) in takeProfits"
          :key="index"
          class="flex flex-row flex-wrap gap-2 relative"
        >
          <label :for="'tp-input' + index" class="min-w-full"
            >Take profit target {{ index + 1 }}
            <span class="text-xs"
              >(&hairsp;{{ getTakeProfitDescription(takeProfit) }}&hairsp;)</span
            >
          </label>

          <!-- TP size -->
          <InputGroup class="flex-1" :style="!index ? 'flex: 0 1 0% !important' : ''">
            <InputGroupAddon>
              <i class="pi pi-send target-icon"></i>
            </InputGroupAddon>
            <div
              v-if="takeProfit.size === INITIAL_TP_SIZE_CODE"
              class="flex flex-row align-items-center p-3 border-1 border-solid surface-border border-round-right"
            >
              Initial
            </div>
            <InputNumber
              v-else
              v-model="takeProfit.size"
              :id="'tp-input' + index"
              showButtons
              buttonLayout="stacked"
              style="height: 4rem"
              suffix="%"
              :min="0"
              :max="getMaxSize(index)"
              :step="10"
              :pt="getPtNumberInput()"
              class="settingInputSmall"
            />
          </InputGroup>
          <!-- TP Xs -->
          <InputGroup class="flex-1">
            <InputNumber
              v-model="takeProfit.xs"
              showButtons
              buttonLayout="stacked"
              style="height: 4rem"
              suffix="x"
              :min="1"
              :step="steps['All Xs']"
              :disabled="!takeProfit.withXs"
              class="settingInputSmall"
              :pt="getPtNumberInput()"
            />
            <InputGroupAddon>
              <Checkbox v-model="takeProfit.withXs" binary />
            </InputGroupAddon>
          </InputGroup>
          <!-- TP ETH -->
          <InputGroup class="flex-1">
            <InputNumber
              v-model="takeProfit.amount"
              showButtons
              buttonLayout="stacked"
              style="height: 4rem"
              :suffix="' ' + currency"
              :min="0"
              :step="steps['All amount']"
              :disabled="!takeProfit.withAmount"
              class="settingInputSmall"
              :pt="getPtNumberInput()"
            />
            <InputGroupAddon>
              <Checkbox v-model="takeProfit.withAmount" binary />
            </InputGroupAddon>
          </InputGroup>
          <div class="flex flex-row flex-1 gap-2">
            <!-- TP MC -->
            <InputGroup>
              <InputNumber
                v-model="takeProfit.mc"
                showButtons
                buttonLayout="stacked"
                style="height: 4rem"
                prefix="$"
                :min="0"
                :step="steps['All MC']"
                :pt="getPtNumberInput()"
                :disabled="!takeProfit.withMc"
                class="settingInput"
              />
              <InputGroupAddon>
                <Checkbox v-model="takeProfit.withMc" binary />
              </InputGroupAddon>
            </InputGroup>
            <!-- logic -->
            <SelectButton
              v-model="takeProfit.andLogic"
              :options="[
                { name: 'AND', value: true },
                { name: 'OR', value: false },
              ]"
              optionLabel="name"
              optionValue="value"
              :allowEmpty="false"
              :disabled="!isMultiTakeProfit(takeProfit)"
              aria-label="Logic"
              class="flex flex-row h-full p-0"
              :pt="{
                button: {
                  class: ['p-button-sm', 'p-2'],
                },
              }"
            />
            <!-- Remove or add target -->
            <div
              :class="[
                'flex flex-column p-0',
                takeProfits.length > 1 ? 'justify-content-evenly' : 'justify-content-center',
              ]"
            >
              <Button
                v-if="index"
                icon="pi pi-plus"
                text
                aria-label="Add before"
                class="p-0"
                v-tooltip.top="{
                  value: `Add a target before this one`,
                  showDelay: 500,
                }"
                @click="addTarget(index)"
              />
              <Button
                v-if="takeProfits.length > 1 && index"
                icon="pi pi-trash"
                text
                severity="secondary"
                aria-label="Remove"
                class="p-0"
                v-tooltip.top="{
                  value: `Remove this target`,
                  showDelay: 500,
                }"
                @click="removeTarget(index)"
              />
            </div>
          </div>
        </div>

        <div v-if="activeTakeProfitCount <= 2" class="text-yellow-300">
          You should really add more than 2 targets to lower price impact
        </div>

        <div class="flex flex-row flex-wrap align-items-center column-gap-5 row-gap-2">
          <Button class="my-3 align-self-start" @click="addTarget()">Add a target</Button>

          <!-- AUTO REDISTRIBUTE -->
          <div class="flex flex-row gap-2 align-items-center">
            <Checkbox
              :modelValue="autoRedistributeTargets"
              inputId="redisOption"
              binary
              class="flex-shrink-0"
              @update:modelValue="emit('update:autoRedistributeTargets', $event)"
            />
            <label for="redisOption">Redistribute </label>
            <InfoButton
              text="If activated, when you add or remove a target, size % for each target is recalculated as an equal share from 100%"
              class="align-self-start"
            />
          </div>

          <template v-if="takeProfits.length >= 2">
            <div class="flex flex-row gap-2 align-items-center">
              <Dropdown
                v-model="incAllTargetKind"
                :options="['All Xs', 'All amount', 'All MC']"
                class="flex-none"
                :pt="{
                  root: { class: 'narrowInput' },
                  label: { class: 'narrowInput' },
                  item: { class: 'pr-5' },
                }"
              />
              <Button
                icon="pi pi-chevron-down"
                size="small"
                severity="secondary"
                outlined
                class="w-2rem"
                aria-label="Decrement"
                v-tooltip.top="{
                  value: `${incAllTargetKind} targets will decrease by ${steps[incAllTargetKind]}`,
                  showDelay: 500,
                }"
                @click="updateAllTarget(false)"
              />
              <Button
                icon="pi pi-chevron-up"
                size="small"
                severity="secondary"
                outlined
                class="w-2rem"
                aria-label="Increment"
                v-tooltip.top="{
                  value: `${incAllTargetKind} targets will increase by ${steps[incAllTargetKind]}`,
                  showDelay: 500,
                }"
                @click="updateAllTarget(true)"
              />
            </div>
          </template>

          <!-- Targets import/export -->
          <div class="flex flex-row gap-2 align-items-center">
            <FileUpload
              ref="targetUploader"
              mode="basic"
              accept="application/json"
              chooseLabel="&nbsp;Import"
              :pt="{
                chooseButton: {
                  class: 'p-button-icon-only p-button-secondary p-button-outlined small-button',
                },
              }"
              v-tooltip.top="{
                value: 'Import targets',
                showDelay: 500,
              }"
              @select="importTargets($event)"
            >
              <template #uploadicon>
                <i class="pi pi-file-import"></i>
              </template>
            </FileUpload>
            <Button
              aria-label="Export targets"
              icon="pi pi-file-export"
              outlined
              severity="secondary"
              v-tooltip.top="{
                value: 'Export targets',
                showDelay: 500,
              }"
              class="small-button"
              @click="exportTargets()"
            />
          </div>
        </div>
</template>

<script setup lang="ts">
import { TakeProfit } from '@/types/TakeProfit'
import { ref, computed } from 'vue'
import { INITIAL_TP_SIZE_CODE, getPtNumberInput } from '../constants'
import {
  downloadDataUrl,
  fixTakeProfits,
  getTextFileContent,
  prettifyMc,
  round,
  sumObjectProperty,
} from '@/lib'
import FileUpload, { FileUploadSelectEvent } from 'primevue/fileupload'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Checkbox from 'primevue/checkbox'
import SelectButton from 'primevue/selectbutton'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import vTooltip from 'primevue/tooltip'
import InfoButton from './InfoButton.vue'

const {
  initialTp,
  autoRedistributeTargets,
  currency = 'Ξ',
  steps,
  whenError,
} = defineProps<{
  initialTp: TakeProfit[]
  autoRedistributeTargets: boolean
  currency?: 'Ξ' | '◎'
  steps: {
    'All Xs': number
    'All amount': number
    'All MC': number
  }
  whenError: (message: string) => void
}>()

const takeProfits = defineModel<TakeProfit[]>('takeProfits', { default: [] })

const emit = defineEmits<{
  (e: 'update:takeProfits', _: TakeProfit[]): void
  (e: 'update:autoRedistributeTargets', _: boolean): void
}>()

const targetUploader = ref<InstanceType<typeof FileUpload>>()

const activeTakeProfitCount = computed(
  () => takeProfits.value.filter(tp => tp.withMc || tp.withXs).length,
)

const isMultiTakeProfit = (tp: TakeProfit): boolean =>
  [tp.withXs, tp.withAmount, tp.withMc].filter(Boolean).length >= 2

const getTakeProfitDescription = (takeProfit: TakeProfit): string => {
  const parts = [
    takeProfit.withXs ? `price ${takeProfit.xs}x` : '',
    takeProfit.withAmount ? `initial bag worth ${takeProfit.amount}${currency}` : '',
    takeProfit.withMc ? `market cap reaches ${prettifyMc(takeProfit.mc)}` : '',
  ].filter(Boolean)
  if (!takeProfit.size || !parts.length) return 'deactivated'

  const multiParts = parts.length > 1
  const joinedParts = parts.join(takeProfit.andLogic ? ' AND ' : ' OR ')

  return `selling ${
    takeProfit.size === INITIAL_TP_SIZE_CODE
      ? 'enough to get back initial investment'
      : round(takeProfit.size) + '%'
  } when${multiParts ? (takeProfit.andLogic ? '' : ' either') : ''} ${joinedParts}`
}

const redistributeTargets = () => {
  if (!autoRedistributeTargets) return
  const size = 100 / (takeProfits.value.length - 1) // not counting "initial" target
  takeProfits.value.forEach(target => {
    if (target.size !== INITIAL_TP_SIZE_CODE && target.size !== size) target.size = size
  })
}
const addTarget = (beforeIndex?: number) => {
  const remainingPct = 100 - sumObjectProperty(takeProfits.value, tp => tp.size)
  const clone = {
    ...initialTp[0],
    ...takeProfits.value[beforeIndex !== undefined ? beforeIndex : takeProfits.value.length - 1],
    size: remainingPct,
  }

  if (beforeIndex !== undefined) {
    takeProfits.value.splice(beforeIndex, 0, clone)
  } else {
    takeProfits.value.push(clone)
  }

  redistributeTargets()
}
const removeTarget = (index: number) => {
  takeProfits.value.splice(index, 1)
  redistributeTargets()
}

const getMaxSize = (index: number): number => {
  const otherTps = [...takeProfits.value]
  otherTps.splice(index, 1)
  return 100 - sumObjectProperty(otherTps, tp => (tp.size === INITIAL_TP_SIZE_CODE ? 0 : tp.size))
}

const incAllTargetKind = ref<'All Xs' | 'All amount' | 'All MC'>('All Xs')

const updateAllTarget = (inc: boolean) => {
  const change = (inc ? 1 : -1) * steps[incAllTargetKind.value]
  const property =
    incAllTargetKind.value === 'All Xs'
      ? 'xs'
      : incAllTargetKind.value === 'All MC'
      ? 'mc'
      : 'amount'
  takeProfits.value.forEach((tp, i) => {
    tp[property] = Math.max(0, tp[property] + change)
  })
}

const exportTargets = () => {
  const data = JSON.stringify(takeProfits.value, null, 2)
  const dataUrl = window.URL.createObjectURL(new Blob([data], { type: 'application/json' }))
  downloadDataUrl(dataUrl, 'targets.json')
}
const importTargets = async (event: FileUploadSelectEvent) => {
  const { files } = event
  if (!files?.length) return
  const text = await getTextFileContent(files[0])
  ;(targetUploader.value as any)?.clear()

  try {
    let targets = JSON.parse(text) as TakeProfit[]
    targets = targets.map(target => ({ ...initialTp[0], ...target }))
    fixTakeProfits(targets, initialTp[0])
    emit('update:takeProfits', targets)
    if (targets.reduce((sum, tp) => sum + tp.size, 0) > 100) redistributeTargets()
  } catch (e) {
    whenError('Wrong format for targets collection')
  }
}
</script>
