<template>
  <main>
    <!-- CONFIG -->
    <div
      class="flex flex-column xl:flex-row gap-3 xl:gap-1 align-items-center xl:align-items-stretch justify-content-center"
    >
      <div class="w-screen xl:w-6 m-1 xl:m-4" style="max-width: min(95vw, 75rem)">
        <FileUpload
          ref="uploader"
          mode="advanced"
          accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          multiple
          :showUploadButton="false"
          :showCancelButton="false"
          chooseLabel="&hairsp;"
          :pt="{
            content: { class: 'p-3 xl:p-5' },
            chooseicon: { class: 'm-0' },
            buttonbar: { class: 'p-0' },
            choosebutton: { class: 'absolute mt-2 ml-2 z-1' },
          }"
          @select="onUpload($event)"
        >
          <template #empty>
            <ProgressSpinner
              v-if="uploading"
              class="absolute top-50 left-50"
              style="width: 99px; height: 99px; transform: translate(-50%, -88%); z-index: 99"
              :pt="{
                spinner: { style: { animationDuration: '0s' } },
              }"
            />

            <div class="flex flex-column m-1 align-items-center justify-content-center">
              <i
                class="pi pi-file mb-4"
                :style="{
                  fontSize: '4rem',
                  color: selectedFile ? 'var(--primary-color)' : 'var(--cyan-300)',
                }"
              />

              <template v-if="selectedFile">
                <InputGroup class="w-auto">
                  <Dropdown
                    v-model="current"
                    optionLabel="fileName"
                    :options="archives"
                    v-bind="{ 'aria-label': 'Current calls file' }"
                    style="max-width: 21rem"
                    scrollHeight="300px"
                  >
                    <template #option="{ option, index }">
                      <div class="flex align-items-center gap-3">
                        <div class="flex-auto">{{ option.fileName }}</div>
                        <Button
                          icon="pi pi-trash"
                          severity="secondary"
                          text
                          rounded
                          size="small"
                          aria-label="Delete"
                          @click.stop="removeArchive(index)"
                        />
                      </div>
                    </template>
                  </Dropdown>
                  <Button
                    v-if="archives.length"
                    icon="pi pi-code"
                    outlined
                    :disabled="archives.length < 2"
                    v-tooltip.bottom="{
                      value:
                        archives.length < 2
                          ? 'You can upload other XLSX to compare calls'
                          : 'Examine differences between 2 files',
                      showDelay: 500,
                    }"
                    aria-label="Difference"
                    style="pointer-events: auto"
                    @click="showDiff = true"
                  >
                    <template #icon>
                      <span class="material-symbols-outlined cursor-pointer">difference</span>
                    </template>
                  </Button>
                </InputGroup>
              </template>
              <template v-else>
                <p class="text-center">Drag and drop a DRBT <strong>backtest export</strong></p>
                <p class="text-center text-sm font-italic text-color-secondary">
                  Nothing is uploaded, computation is done by your browser
                </p>
              </template>
            </div>
          </template>

          <template #content>
            <div />
          </template>
        </FileUpload>

        <Message v-if="error" severity="error" :icon="'none'" class="m-6">{{ error }}</Message>

        <Accordion :activeIndex="[0]" multiple lazy class="mt-5">
          <!-- RESULTS -->
          <AccordionTab
            header="STATISTICS"
            :pt="{
              root: { class: 'relative ' + (isSticky ? 'sticky' : '') },
            }"
          >
            <Button
              size="small"
              text
              severity="secondary"
              tabindex="-1"
              class="stickyButton"
              aria-label="Pin"
              v-tooltip.left="{
                value: isSticky ? 'Unpin' : 'Pin',
                showDelay: 500,
              }"
              @click.stop="isSticky = !isSticky"
            >
              <template #icon>
                <span class="material-symbols-outlined cursor-pointer">{{
                  isSticky ? 'keep_off' : 'keep'
                }}</span>
              </template>
            </Button>

            <Button
              v-if="withAccuracyAddy"
              icon="pi pi-info"
              aria-label="Show accuracy"
              outlined
              rounded
              class="mb-2"
              @click="showAccuracy = true"
            />
            <Statistics
              :loading="loading"
              info
              :final="finalWorth"
              :drawdown="drawdown"
              :volume="volume"
              :worstDrawdown="worstDrawdown"
              :counters="counters"
              :nbCalls="filteredCalls.length"
              :no-api-key="!state.chainApiKey"
              :full-stats="state.showFullStats"
              :buyInfo="buyInfo"
              @fullStats="state.showFullStats = $event"
            />
          </AccordionTab>

          <!-- LOGS -->
          <AccordionTab
            header="LOGS"
            :pt="{
              root: { class: 'relative' },
              content: { class: 'p-0' },
            }"
            ><LogsTable
              :logs="logs"
              v-model:textual="state.textLogs"
              v-model:selectedColumns="state.logsColumns"
              withDisplaySwitch
              withActions
              chain="ETH"
              :screener-url="state.screenerUrl"
              :timezone="state.timezone"
              @ignore="ignoreCa"
              @rug="onRug"
              @exportXlsx="exportXlsx"
            />
          </AccordionTab>

          <!-- TARGETS -->
          <AccordionTab header="TARGET SIMULATOR" :pt="{ content: { class: 'p-0' } }">
            <TargetFinder
              chain="ETH"
              :data="{
                calls: filteredCalls,
                position: state.position,
                gweiDelta: state.gweiDelta,
                prioBySnipes: computedPrioBySnipes,
                buyTaxInXs: state.buyTaxInXs,
                feeInXs: state.feeInXs,
                chainApiKey: state.chainApiKey,
              }"
              :xsRange="[10, 50, 250]"
              :mcRange="[1000000, 1000000, 20000000]"
              :amountRange="[1, 1, 20]"
            />
          </AccordionTab>

          <!-- ATH -->
          <AccordionTab header="ATH DELAY" :pt="{ content: { class: 'p-0' } }">
            <AthStatistics :calls="filteredCalls" />
          </AccordionTab>

          <!-- TIMING -->
          <AccordionTab header="DAILY BREAKDOWN" :pt="{ content: { class: 'p-0' } }">
            <TimingFinder :logs="logs" :limited="state.withHours" />
          </AccordionTab>

          <!-- HASHES -->
          <AccordionTab header="FUNCTIONS HASH" :pt="{ content: { class: 'p-0' } }">
            <HashTable
              :lines="hashesWithTags"
              filter-template="~HashF.str.contains('{}', na=False)"
              v-model:selectedColumns="state.hashColumns"
              :screener-url="state.screenerUrl"
              :timezone="state.timezone"
              @removeTag="removeTag"
              @addTag="addTag"
            />
          </AccordionTab>

          <!-- SIGNATURES -->
          <AccordionTab header="FUNCTION SIGNATURE" :pt="{ content: { class: 'p-0' } }">
            <HashTable
              :lines="signaturesWithTags"
              filter-template="~FList.str.contains('{}', na=False)"
              v-model:selectedColumns="state.hashColumns"
              :screener-url="state.screenerUrl"
              :timezone="state.timezone"
              @removeTag="removeTag"
              @addTag="addTag"
            />
          </AccordionTab>

          <!-- GAS -->
          <AccordionTab header="GAS" :pt="{ content: { class: 'p-0' } }">
            <HashTable
              :lines="gasesWithTags"
              filter-template="Gas not in [{}]"
              v-model:selectedColumns="state.hashColumns"
              :screener-url="state.screenerUrl"
              :timezone="state.timezone"
              @removeTag="removeTag"
              @addTag="addTag"
            />
          </AccordionTab>
        </Accordion>
      </div>

      <div
        class="flex flex-column mx-1 xl:mx-4 my-2 gap-3 lg:gap-4"
        style="max-width: min(95vw, 60rem)"
      >
        <div class="flex flex-row flex-wrap gap-3 lg:gap-4 mb-3">
          <!-- POSITION -->
          <div class="flex flex-column gap-2 flex-1">
            <label for="position-input">Max bag</label>
            <InputGroup>
              <InputGroupAddon>
                <i class="pi pi-wallet"></i>
              </InputGroupAddon>
              <InputNumber
                v-model="state.position"
                v-bind="{ id: 'position-input' }"
                showButtons
                buttonLayout="stacked"
                suffix=" Ξ"
                :min="0.005"
                mode="decimal"
                :step="0.005"
                :minFractionDigits="0"
                :maxFractionDigits="3"
                :pt="getPtNumberInput()"
                class="settingInput"
                style="height: 4rem"
              />
            </InputGroup>
          </div>

          <!-- GAS PRICE -->
          <div class="flex flex-row align-items-end flex-1">
            <div class="flex flex-column gap-2 flex-grow-1">
              <label for="gwei-input"
                >Priority (GWEI delta) {{ state.conditionalPrio ? 'based on bribes' : '' }}</label
              >
              <InputGroup>
                <InputGroupAddon>
                  <span class="material-symbols-outlined">local_gas_station</span>
                </InputGroupAddon>
                <InputNumber
                  v-model="state.gweiDelta"
                  v-bind="{ id: 'gwei-input' }"
                  showButtons
                  buttonLayout="stacked"
                  :min="1"
                  :step="1"
                  mode="decimal"
                  :minFractionDigits="1"
                  :maxFractionDigits="1"
                  :disabled="state.conditionalPrio"
                  :pt="getPtNumberInput()"
                  class="settingInput"
                  style="height: 4rem"
                />
              </InputGroup>
            </div>
            <!-- CONDITIONAL PRIO SWITCH -->
            <!--
            <div
              v-tooltip.top="{
                value: `Priority based on bribes`,
                showDelay: 500,
              }"
              class="flex flex-column gap-1 mb-3 align-items-center ml-4 mr-2"
            >
              <label for="conditional-prio" class="text-xs">Conditionnal</label>
              <InputSwitch v-model="state.conditionalPrio" inputId="conditional-prio" />
            </div>
            <Button
              v-if="state.conditionalPrio"
              icon="pi pi-cog"
              text
              aria-label="Configure conditional priorities"
              class="mb-2"
              v-tooltip.top="{
                value: `Configure conditional priorities`,
                showDelay: 500,
              }"
              :pt="{ icon: { class: 'text-xl' } }"
              @click="configuringPrios = !configuringPrios"
            />
            -->
          </div>
        </div>

        <!-- TP -->
        <Targets
          v-model:takeProfits="state.takeProfits"
          v-model:autoRedistributeTargets="state.autoRedistributeTargets"
          :initial-tp="INIT_TP"
          currency="Ξ"
          :whenError="errorMessage"
          :steps="{
            'All Xs': 1,
            'All amount': 0.1,
            'All MC': 100000,
          }"
        />

        <!-- START -->
        <div class="flex flex-row flex-wrap gap-2">
          <label for="start-input" class="min-w-full"
            >Start date <span class="text-xs">(no limit if empty)</span></label
          >

          <InputGroup class="flex-50">
            <InputGroupAddon>
              <span class="material-symbols-outlined">today</span>
            </InputGroupAddon>
            <Button icon="pi pi-minus" outlined severity="secondary" @click="incStartDate(-1)" />
            <InputMask
              v-model="selection.startDate"
              v-bind="{ id: 'start-input', placeholder: 'YYYY-MM-DD' }"
              style="height: 4rem"
              mask="9999-99-99"
              class="settingInput"
            />
            <Button icon="pi pi-plus" outlined severity="secondary" @click="incStartDate()" />
          </InputGroup>
          <InputGroup class="flex-1">
            <InputMask
              v-model="selection.startHour"
              style="height: 4rem"
              mask="99:99"
              v-bind="{ placeholder: '00:00' }"
              class="settingInputSmall"
            />
            <!-- prettier-ignore -->
            <Button
              icon="pi pi-times"
              outlined
              severity="secondary"
              @click="
                selection.startDate = '';
                selection.startHour = '';
              "
            />
          </InputGroup>
        </div>
        <!-- END DATE -->
        <div class="flex flex-row flex-wrap gap-2">
          <label for="end-input" class="min-w-full"
            >End date <span class="text-xs">(no limit if empty)</span></label
          >
          <InputGroup class="flex-50">
            <InputGroupAddon>
              <span class="material-symbols-outlined">event</span>
            </InputGroupAddon>
            <Button icon="pi pi-minus" outlined severity="secondary" @click="incEndDate(-1)" />
            <InputMask
              v-model="selection.endDate"
              v-bind="{ id: 'end-input', placeholder: 'YYYY-MM-DD' }"
              style="height: 4rem"
              mask="9999-99-99"
              class="settingInput"
            />
            <Button icon="pi pi-plus" outlined severity="secondary" @click="incEndDate()" />
          </InputGroup>
          <InputGroup class="flex-1">
            <InputMask
              v-model="selection.endHour"
              style="height: 4rem"
              mask="99:99"
              v-bind="{ placeholder: '00:00' }"
              class="settingInputSmall"
            />
            <!-- prettier-ignore -->
            <Button
              icon="pi pi-times"
              outlined
              severity="secondary"
              @click="
                selection.endDate = '';
                selection.endHour = '';
              "
            />
          </InputGroup>
        </div>
        <!-- DAYS & HOURS -->
        <div class="flex flex-column gap-4">
          <div class="flex gap-2 pt-1">
            <InputSwitch v-model="state.withHours" inputId="hours-global" />
            <label for="hours-global"
              >Custom trading periods<span class="text-xs"> (UTC)</span></label
            >
          </div>
          <div v-if="state.withHours" class="card flex flex-wrap justify-content-start gap-3">
            <div
              v-for="day in allDays"
              :key="day.index"
              class="flex gap-2 flex-wrap align-items-center"
            >
              <TriStateCheckbox
                v-model="state.week[day.index]"
                :inputId="day.name"
                :pt="{
                  box: {
                    class:
                      state.week[day.index] === false
                        ? 'bg-orange-300 border-orange-300'
                        : state.week[day.index] === null
                        ? 'bg-primary border-primary'
                        : undefined,
                  },
                }"
              >
                <template #nullableicon="scope"></template>
              </TriStateCheckbox>
              <label :for="day.name" class="">
                {{ day.name + (state.week[day.index] === null ? ':' : '') }}
              </label>

              <template
                v-if="state.week[day.index] === null"
                v-for="hour in allHours"
                :key="`${day.name}-${hour}`"
              >
                <Checkbox
                  v-model="state.hours[day.index][hour]"
                  binary
                  :disabled="state.week[day.index] !== null"
                  :inputId="`${day.name}-${hour}`"
                  :pt="{
                    input: {
                      style:
                        'border: 2px solid #424b57; background: #111827; color: var(--primary-color)',
                    },
                    icon: {
                      class: 'text-primary',
                    },
                  }"
                >
                  <template #icon="scope">
                    <i
                      :class="[
                        'pi font-bold text-xs border-primary',
                        scope.checked ? 'pi-check text-primary' : 'pi-times text-orange-300',
                        scope.class,
                      ]"
                    ></i>
                  </template>
                </Checkbox>
                <label
                  :for="`${day.name}-${hour}`"
                  :class="[
                    'mr-1',
                    state.week[day.index] === null ? 'text-color-secondary' : 'text-200',
                  ]"
                >
                  {{ hour }}
                </label>
                <span v-if="hour === 11" class="flex-br" />
              </template>
              <span
                v-if="state.week[day.index] === null"
                class="ml-1 iconButton text-lg material-symbols-outlined"
                v-tooltip.bottom="{
                  value: state.hours[day.index][0] ? 'Uncheck all hours' : 'Check all hours',
                  showDelay: 500,
                }"
                @click="toggleHours(day.index)"
                >{{ state.hours[day.index][0] ? 'remove_done' : 'done_all' }}</span
              >
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-3 flex-column md:flex-row md:align-items-end mt-3">
          <!-- MIN CALLS -->
          <div class="flex flex-column gap-2">
            <label for="mincalls-input">Minimum calls count to show hashes/sigs</label>
            <InputGroup>
              <InputGroupAddon>
                <i class="pi pi-megaphone"></i>
              </InputGroupAddon>
              <InputNumber
                v-model="state.minCallsForHash"
                v-bind="{ id: 'mincalls-input' }"
                showButtons
                buttonLayout="stacked"
                :min="0"
                :step="1"
                :pt="getPtNumberInput()"
                class="settingInput"
              />
            </InputGroup>
          </div>
          <!-- DEX URL -->
          <div class="flex flex-column gap-2">
            <label for="screener-input">Screener URL</label>
            <InputGroup>
              <InputGroupAddon>
                <i class="pi pi-chart-line"></i>
              </InputGroupAddon>
              <InputText
                v-model.trim="state.screenerUrl"
                id="screener-input"
                class="settingInput"
              />
            </InputGroup>
          </div>
          <!-- Timezone -->
          <div class="flex flex-column gap-2">
            <label for="timezone-input">Timezone</label>
            <InputGroup>
              <InputGroupAddon>
                <i class="pi pi-clock"></i>
              </InputGroupAddon>
              <Dropdown
                v-model="state.timezone"
                v-bind="{ id: 'timezone-input' }"
                :options="timezoneOptions"
                optionLabel="label"
                optionValue="value"
                :pt="getPtNumberInput()"
                class="settingInput"
                scrollHeight="300px"
                filter
                filterPlaceholder="Search timezone"
              />
            </InputGroup>
          </div>
        </div>
        <div class="flex flex-wrap gap-3 flex-column md:flex-row md:align-items-end">
          <!-- ALCHEMY API KEY -->
          <div class="flex flex-column gap-2 flex-1">
            <label for="api-input"
              ><a href="https://auth.alchemy.com/signup" target="_blank">Alchemy</a> API key&nbsp;
              <InfoButton
                text="In order to simulate more accurate swaps, we can fetch mainnet block transaction info (call blocks +1 and sometimes +2) in order to see how many buyers would front-run you, so we can calculate a realistic slippage, even if far from perfect, even if your query might have changed since then and calls delay were different back then.<br />Indeed the app doesn't know your wallet or even if you bought that token at all. It's just your priority vs. real transactions.<br/>Register for free on alchemy.com, create an APP, select Mainnet Ethereum, and then copy the API key from that app to paste it in here."
                :accent="!state.chainApiKey"
                class="align-self-start"
            /></label>
            <InputGroup>
              <InputGroupAddon>
                <i class="pi pi-ethereum"></i>
              </InputGroupAddon>
              <InputText v-model.trim="state.chainApiKey" id="api-input" class="settingInput" />
            </InputGroup>
          </div>
          <!-- DRBT API -->
          <div class="flex flex-column gap-2 flex-1">
            <label for="drbt-input"
              >DRBT API key&nbsp;
              <InfoButton
                text="In order to automatically set or unset token rug status in DRBT database when clicking Rug action in the call logs, enter the API key provided by @DeFiRobot_Helper_Bot with /api_token command"
                class="align-self-start"
            /></label>
            <InputGroup>
              <InputGroupAddon>
                <i class="pi pi-key"></i>
              </InputGroupAddon>
              <InputText
                v-model.trim="state.drbtApiKey"
                id="drbt-input"
                :pt="getPtNumberInput()"
                class="settingInput"
              />
            </InputGroup>
          </div>
        </div>
        <div class="flex flex-column md:flex-row flex-wrap md:align-items-center gap-3 mt-4">
          <!-- PRICE IMPACT -->
          <div class="flex flex-row gap-2 align-items-center">
            <Checkbox
              inputId="impactOption"
              v-model="state.withPriceImpact"
              binary
              class="flex-shrink-0"
            />
            <label for="impactOption">Sale price impact </label>
            <InfoButton
              :text="`When selling at each target, a price impact is deduced from the sale by guessing the LP size. So gains are more realistic, especially when selling big bags. You might want to add several take profit targets in order to lower those impacts`"
              class="align-self-start"
            />
          </div>
          <!-- TAX TARGET -->
          <div class="flex flex-row gap-2 align-items-center">
            <Checkbox inputId="taxOption" v-model="state.buyTaxInXs" binary class="flex-shrink-0" />
            <label for="taxOption">Targets include tax </label>
            <InfoButton
              text="If activated, buy tax lowers Xs and thus impacts targets. If not activated, buy tax only impacts final profit and not targets"
              class="align-self-start"
            />
          </div>
          <!-- GAS TARGET -->
          <div class="flex flex-row gap-2 align-items-center">
            <Checkbox inputId="feeOption" v-model="state.feeInXs" binary class="flex-shrink-0" />
            <label for="feeOption">Targets include gas </label>
            <InfoButton
              text="If activated, Xs target is using the same calculation than sniper bots [profit% = worth/(initial+gas)). If not activated, Xs target is just targetPrice/entryPrice. Whichever you choose, gas cost is just a flat value deduced from profit."
              class="align-self-start"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- CONDITIONAL PRIORITY VALUES -->
    <Sidebar
      ref="conditionalPrioFields"
      :visible="!!configuringPrios"
      position="right"
      :modal="false"
      header="Used gas priority based on number of bribes"
      :dismissable="false"
      :pt="{
        root: {
          class: 'w-full md:w-min',
        },
      }"
      @update:visible="configuringPrios = false"
      @hide="configuringPrios = false"
    >
      <div class="flex flex-row flex-wrap gap-3 m-2 justify-content-center">
        <div
          v-for="snipesThreshold in state.prioBySnipes"
          :key="snipesThreshold[0]"
          class="flex flex-column gap-1"
        >
          <label :for="'snipe-th-' + snipesThreshold"
            >{{ getPrioTitle(snipesThreshold[0]) }}
          </label>
          <InputNumber
            v-model="snipesThreshold[1]"
            v-bind="{ id: 'snipe-th-' + snipesThreshold[0] }"
            showButtons
            buttonLayout="stacked"
            :min="1"
            :step="1"
            mode="decimal"
            :minFractionDigits="1"
            :maxFractionDigits="1"
            suffix="  GWEI"
            :pt="getPtNumberInput()"
            class="settingInput"
          />
        </div>
      </div>
    </Sidebar>

    <Toast />

    <DiffDialog
      v-if="current && showDiff"
      v-model:logsColumns="state.logsColumns"
      :archives="archives"
      :current="current"
      :screener-url="state.screenerUrl"
      chain="ETH"
      :computingParams="{
        position: state.position,
        gweiDelta: state.gweiDelta,
        prioBySnipes: computedPrioBySnipes,
        buyTaxInXs: state.buyTaxInXs,
        feeInXs: state.feeInXs,
        chainApiKey: state.chainApiKey,
        takeProfits: JSON.parse(JSON.stringify(state.takeProfits)),
        withPriceImpact: state.withPriceImpact,
      }"
      @closed="showDiff = false"
      @ignore="ignoreCa"
    />

    <ScatterDialog v-if="showAccuracy" :data="accuracyLogs" @closed="showAccuracy = false" />
  </main>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import ProgressSpinner from 'primevue/progressspinner'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import InputGroup from 'primevue/inputgroup'
import InputGroupAddon from 'primevue/inputgroupaddon'
import FileUpload, { type FileUploadSelectEvent } from 'primevue/fileupload'
import Accordion from 'primevue/accordion'
import AccordionTab from 'primevue/accordiontab'
import Message from 'primevue/message'
import InputMask from 'primevue/inputmask'
import InputSwitch from 'primevue/inputswitch'
import Button from 'primevue/button'
import Sidebar from 'primevue/sidebar'
import Checkbox from 'primevue/checkbox'
import TriStateCheckbox from 'primevue/tristatecheckbox'
import HashTable from './components/HashTable.vue'
import DiffDialog from './components/DiffDialog.vue'
import ScatterDialog from './components/ScatterDialog.vue'
import Targets from './components/Targets.vue'
import InfoButton from './components/InfoButton.vue'
import Toast from 'primevue/toast'
import Dropdown from 'primevue/dropdown'
import vTooltip from 'primevue/tooltip'
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import {
  debounce,
  localStorageSetObject,
  localStorageGetObject,
  addTagsToHashes,
  sumObjectProperty,
  sleep,
  prettifyMc,
  round,
  mergeOrderedTuples,
  downloadDataUrl,
  getTextFileContent,
  downloadRowsXlsx,
  getRowsCorrespondingToLogs,
  drbtSetRug,
  getHeaderIndexes,
  fixTakeProfits,
} from './lib'
import { type CallArchive, type Call, type DiffType } from './types/Call'
import type { AccuracyLog, Log } from './types/Log'
import type { TakeProfit } from './types/TakeProfit'
import type { HashInfo } from './types/HashInfo'
import LogsTable from './components/LogsTable.vue'
import TargetFinder from './components/TargetFinder.vue'
import TimingFinder from './components/TimingFinder.vue'
import {
  DEFAULT_GAS_USED,
  DEFAULT_SCREENER_URL,
  getPtNumberInput,
  INITIAL_TP_SIZE_CODE,
  SELL_GAS_PRICE,
  SELL_TAX,
} from './constants'
import Statistics from './components/Statistics.vue'
import AthStatistics from './components/AthStatistics.vue'
import useTags from './compose/useTags'
import { ComputationResult } from './types/ComputationResult'
import { useTimezone } from './compose/useTimezone'

const error = ref('')
const loading = ref<string | boolean>(false)
const uploading = ref(0)
const uploader = ref<InstanceType<typeof FileUpload>>()
const configuringPrios = ref(false)
const conditionalPrioFields = ref<InstanceType<typeof Sidebar>>()

const onUpload = async (event: FileUploadSelectEvent) => {
  const { files } = event
  if (!files?.length) return

  const allXlsx = [...files]
  ;(uploader.value as any)?.clear()

  uploading.value = allXlsx.length
  worker.value?.postMessage({ type: 'XLSX', allXlsx })
}

const showDiff = ref(false)
const accuracyLogs = ref<AccuracyLog[] | null>(null)
const logs = ref<Log[]>([])

const { localTags, removeTag, addTag } = useTags()
const hashes = ref<Record<string, HashInfo>>({})
const hashesWithTags = computed<HashInfo[]>(() =>
  addTagsToHashes(hashes.value, localTags.value, state.minCallsForHash),
)
const signatures = ref<Record<string, HashInfo>>({})
const signaturesWithTags = computed<HashInfo[]>(() =>
  addTagsToHashes(signatures.value, localTags.value, state.minCallsForHash),
)
const gases = ref<Record<string, HashInfo>>({})
const gasesWithTags = computed<HashInfo[]>(() =>
  addTagsToHashes(gases.value, localTags.value, state.minCallsForHash),
)

const archives = ref<CallArchive[]>([])
const current = ref<CallArchive | null>(null)
const removeArchive = (index: number) => {
  if (archives.value[index].fileName === current.value?.fileName) current.value = archives.value[0]
  archives.value.splice(index, 1)
}
const selectedFile = computed(() => current.value?.fileName || '')
const calls = computed(() => current.value?.calls || [])
const filteredCalls = computed<Call[]>(() =>
  calls.value.filter(call => {
    // filtering period
    if (selection.startDate) {
      const time = selection.startHour?.match(/\d\d:\d\d/) ? selection.startHour : '00:00'
      const fullStart = `${selection.startDate}T${time}:00.000Z`
      if (call.date < fullStart) return false
    }
    if (selection.endDate) {
      const time = selection.endHour?.match(/\d\d:\d\d/) ? selection.endHour : '00:00'
      const fullEnd = `${selection.endDate}T${time}:00.000Z`
      if (call.date > fullEnd) return false
    }

    // filtering trading hours and days
    if (state.withHours && state.week.some(active => !active)) {
      const date = new Date(call.date)
      const callDay = date.getUTCDay()
      if (state.week[callDay]) return true
      else if (state.week[callDay] === false) return false
      // when null: costom hours
      const callHour = date.getUTCHours()
      return state.hours[callDay][callHour]
    }

    return true
  }),
)

async function storeData(rows: (string | number | Date)[][], fileName: string) {
  if (rows.length <= 1) return

  const indexes = getHeaderIndexes(
    rows[0],
    [
      'LiveAt',
      'Name',
      'CA',
      'Rug',
      'CRT_ATH_MC', // ATH at the time of export
      'CRT_ATH_Date',
      'ATH_MC', // ATH at the time of call
      'TSupply',
      'MaxBuyPRCT', // MaxBuy is not realiable, using percentage instead
      'CRT_MC', // call-time MC (CRT_MC_ is present-time MC)
      'HashF',
      'BuyTax',
      'Logged',
      'LaunchedDelay',
      'FList',
      'GWEI',
      'Gas',
      'Bribes',
      'PriorityMin',
      'PriorityMax',
      'PriorityAVG',
      'LP_CRT',
      'Block',
      'ETHPrice',
      'Decimals',
      'LPVersion',
    ],
    message => {
      error.value = message
    },
  )

  if (!indexes) return

  let newCalls: Call[] = []
  for (const rowIndex in rows) {
    if (!rowIndex || rowIndex === '0') continue // ignore headers

    const row = rows[rowIndex]
    const parsedLaunch = row[indexes.LiveAt] as Date
    const parsedDate = row[indexes.Logged] as Date
    const parsedAthDate = row[indexes.CRT_ATH_Date] as Date
    if (!parsedDate || !parsedAthDate) continue
    try {
      parsedLaunch.setHours(parsedLaunch.getHours() - 1) // not sure why dates are UTC+1 in the XLSX
      parsedDate.setHours(parsedDate.getHours() - 1) // not sure why dates are UTC+1 in the XLSX
      parsedAthDate.setHours(parsedAthDate.getHours() - 1) // not sure why dates are UTC+1 in the XLSX
    } catch (e) {
      continue
    }
    const ca = row[indexes.CA] as string
    const supply = row[indexes.TSupply] as number
    const callMc = row[indexes.CRT_MC] as number
    const price = callMc / supply
    const ath = row[indexes.CRT_ATH_MC] as number
    const xs = ath / callMc
    const athDelayHours = (parsedAthDate.getTime() - parsedLaunch.getTime()) / (1000 * 60 * 60)

    newCalls.push({
      name: row[indexes.Name] as string,
      ca,
      nameAndCa: ((row[indexes.Name] as string) + row[indexes.CA]) as string,
      price,
      supply,
      callMc,
      buyTax: (row[indexes.BuyTax] as number) / 100,
      ath,
      athDate: parsedAthDate.toISOString(),
      athDelayHours,
      xs,
      callTimeAth: row[indexes.ATH_MC] as number,
      date: parsedDate.toISOString(),
      delay: row[indexes.LaunchedDelay] as number,
      fList: row[indexes.FList] as string,
      maxBuy: ((row[indexes.MaxBuyPRCT] as number) || 100) / 100,
      rug: !!row[indexes.Rug] || state.rugs.includes(ca),
      hashF: row[indexes.HashF] as string,
      gwei: row[indexes.GWEI] as number,
      buyGas: (row[indexes.Gas] as number) || 0,
      nbBribes: row[indexes.Bribes] as number,
      lp: row[indexes.LP_CRT] as number,
      block: row[indexes.Block] as number,
      ethPrice: indexes.ETHPrice > -1 ? (row[indexes.ETHPrice] as number) : 3500,
      ignored: state.blackList.includes(ca),
      decimals: (row[indexes.Decimals] as number) || 18,
      lpVersion: (row[indexes.LPVersion] as number) || 2,
    })
  }

  newCalls.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const newArchive = { calls: newCalls, fileName, rows, caColumn: indexes.CA }
  current.value = newArchive
  const existIndex = archives.value.findIndex(a => a.fileName === newArchive.fileName)
  if (existIndex > -1) archives.value.splice(existIndex, 1, newArchive)
  else archives.value.push(newArchive)
}

const INIT_POSITION = 0.05
// prettier-ignore
const INIT_TP = [
  { "size": INITIAL_TP_SIZE_CODE, "xs": 10, "withXs": false, "mc": 1000000, "withMc": false, "amount": 0.5, "withAmount": false, "andLogic": true },
  { "size": 33.333333333333336, "xs": 50, "withXs": true, "mc": 1000000, "withMc": false, "amount": 2.5, "withAmount": false, "andLogic": true },
  { "size": 33.333333333333336, "xs": 50, "withXs": false, "mc": 1000000, "withMc": true, "amount": 5, "withAmount": false, "andLogic": true },
  { "size": 33.333333333333336, "xs": 100, "withXs": true, "mc": 10000000, "withMc": true, "amount": 10, "withAmount": false, "andLogic": false }
] as TakeProfit[]
const INIT_GWEI = 5
const INIT_PRIO_BY_SNIPES = [
  [-1, 3],
  [-3, 4],
  [0, 2],
  [1, 2],
  [2, 5],
  [10, 6],
  [20, 7],
  [30, 8],
  [40, 9],
  [50, 10],
] as [number, number][]
const INIT_CONDITIONAL_PRIO = false
const INIT_MIN_CALLS = 5
const INIT_HASH_COLUMNS = ['Count', 'Average', 'x100', 'ATH', 'Tags']
const INIT_LOGS_COLUMNS = ['Invested', 'Entry MC']
const INIT_TEXT_LOGS = false
const INIT_BUY_TAX_IN_XS = true
const INIT_FEE_IN_XS = true
const INIT_WITH_HOURS = false
const INIT_WEEK = [true, true, true, true, true, true, true] as (boolean | null)[]
// prettier-ignore
const INIT_HOURS = [
  [ true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true ],
  [ true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true ],
  [ true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true ],
  [ true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true ],
  [ true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true ],
  [ true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true ],
  [ true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true ],
];
const INIT_AUTO_REDISTRIBUTE = true
const INIT_PRICE_IMPACT = true
const INIT_FULL_STATS = false
const INIT_SCREENER_URL = DEFAULT_SCREENER_URL
const INIT_TIMEZONE = 'UTC'
const state = reactive({
  position: INIT_POSITION,
  takeProfits: INIT_TP,
  gweiDelta: INIT_GWEI,
  prioBySnipes: INIT_PRIO_BY_SNIPES,
  conditionalPrio: INIT_CONDITIONAL_PRIO,
  minCallsForHash: INIT_MIN_CALLS,
  hashColumns: INIT_HASH_COLUMNS,
  logsColumns: INIT_LOGS_COLUMNS,
  textLogs: INIT_TEXT_LOGS,
  buyTaxInXs: INIT_BUY_TAX_IN_XS,
  feeInXs: INIT_FEE_IN_XS,
  chainApiKey: '',
  drbtApiKey: '',
  withHours: INIT_WITH_HOURS,
  week: INIT_WEEK,
  hours: INIT_HOURS,
  autoRedistributeTargets: INIT_AUTO_REDISTRIBUTE,
  withPriceImpact: INIT_PRICE_IMPACT,
  blackList: [] as string[],
  rugs: [] as string[],
  showFullStats: INIT_FULL_STATS,
  screenerUrl: INIT_SCREENER_URL,
  timezone: INIT_TIMEZONE,
})

const updatedSomeRug = ref(false)

const selection = reactive({
  startDate: '',
  startHour: '',
  endDate: '',
  endHour: '',
})

const allDays = [
  { index: 1, name: 'Monday' },
  { index: 2, name: 'Tuesday' },
  { index: 3, name: 'Wednesday' },
  { index: 4, name: 'Thursday' },
  { index: 5, name: 'Friday' },
  { index: 6, name: 'Saturday' },
  { index: 0, name: 'Sunday' },
]
const allHours = Array.from({ length: 24 }, (_, index) => index)
const withAccuracyAddy = import.meta.env.VITE_MY_ADDY_FOR_ACCURACY
const showAccuracy = ref(false)
const initialized = ref(false)
const finalWorth = ref(0)
const drawdown = ref(0)
const volume = ref(0)
const worstDrawdown = ref<[string, number]>(['', 0])
const counters = ref<ComputationResult['counters']>({
  rug: 0,
  unrealistic: 0,
  postAth: 0,
  x100Sum: 0,
  x100: 0,
  x50: 0,
  x20: 0,
  x10: 0,
  x5: 0,
  x2: 0,
})

const isSticky = ref(false)

const STATE_STORAGE_KEY = 'state-c'
function storeForm() {
  localStorageSetObject(STATE_STORAGE_KEY, state)
}
watch(state, () => storeForm(), { deep: true })
function loadForm() {
  const savedState = localStorageGetObject(STATE_STORAGE_KEY)
  if (!savedState) return

  state.position = savedState.position ?? INIT_POSITION
  state.takeProfits = savedState.takeProfits ? [...savedState.takeProfits] : INIT_TP
  fixTakeProfits(state.takeProfits, INIT_TP[0])
  state.gweiDelta = savedState.gweiDelta ?? INIT_GWEI
  state.prioBySnipes = mergeOrderedTuples(INIT_PRIO_BY_SNIPES, savedState.prioBySnipes || [])
  state.conditionalPrio = INIT_CONDITIONAL_PRIO // savedState.conditionalPrio ?? INIT_CONDITIONAL_PRIO
  state.minCallsForHash = savedState.minCallsForHash ?? INIT_MIN_CALLS
  state.hashColumns = savedState.hashColumns ?? INIT_HASH_COLUMNS
  state.logsColumns = savedState.logsColumns ?? INIT_LOGS_COLUMNS
  state.textLogs = savedState.textLogs ?? INIT_TEXT_LOGS
  state.buyTaxInXs = savedState.buyTaxInXs ?? INIT_BUY_TAX_IN_XS
  state.feeInXs = savedState.feeInXs ?? INIT_FEE_IN_XS
  state.chainApiKey = savedState.chainApiKey ?? ''
  state.drbtApiKey = savedState.drbtApiKey ?? ''
  state.withHours = savedState.withHours ?? INIT_WITH_HOURS
  state.week = savedState.week ?? INIT_WEEK
  state.hours = savedState.hours ?? INIT_HOURS
  state.autoRedistributeTargets = savedState.autoRedistributeTargets ?? INIT_AUTO_REDISTRIBUTE
  state.withPriceImpact = savedState.withPriceImpact ?? INIT_PRICE_IMPACT
  state.showFullStats = savedState.showFullStats ?? INIT_FULL_STATS
  state.screenerUrl = savedState.screenerUrl ?? INIT_SCREENER_URL
  state.timezone = savedState.timezone ?? INIT_TIMEZONE
  state.blackList = savedState.blackList
    ? typeof savedState.blackList === 'string'
      ? savedState.blackList.split(',').map(ca => ca.trim())
      : savedState.blackList
    : []
  state.rugs = savedState.rugs || []
}
onMounted(() => {
  loadForm()
  initialized.value = true
})

const ignoreCa = (ca: string, isIgnored: boolean) => {
  if (isIgnored) state.blackList.push(ca)
  else state.blackList = state.blackList.filter(_ca => _ca !== ca)

  for (const archive of archives.value) {
    archive.calls = archive.calls.map(call => ({
      ...call,
      ignored: ca === call.ca ? isIgnored : call.ignored,
    }))
  }
}

const onRug = async (ca: string, isRug: boolean) => {
  if (state.drbtApiKey) {
    const ok = await drbtSetRug(ca, isRug, state.drbtApiKey, toast)
    if (!ok) return
  } else {
    // Rug command to clipboard
    const command = `/setrug ${ca} ${isRug ? '1' : '0'}`
    navigator.clipboard.writeText(command)
    toast.add({
      severity: 'warn',
      summary: `Rug status updated locally`,
      detail: `To update DRBT's database, either get an API key from @DeFiRobot_Helper_Bot with /api_token command and enter it in the field at the end of this app,\n\nor just DM @DeFi_Robot_ETH_bot with the /setrug command from your clipboard and then check with /getruglog`,
      life: 60000,
    })
  }

  if (isRug) state.rugs = [...state.rugs, ca]
  else state.rugs = state.rugs.filter(_ca => _ca !== ca)

  for (const archive of archives.value) {
    archive.calls = archive.calls.map(call => ({ ...call, rug: ca === call.ca ? isRug : call.rug }))
    updatedSomeRug.value = true

    const indexes = getHeaderIndexes(archive.rows[0], ['CA', 'Rug'], message => {
      error.value = message
    })!
    const row = archive.rows.find(row => row[indexes.CA] === ca)
    if (!row) return
    row[indexes.Rug] = isRug ? '1' : '0'
  }
}

const computedPrioBySnipes = computed(() =>
  state.conditionalPrio ? JSON.parse(JSON.stringify(state.prioBySnipes)) : null,
)
const getPrioTitle = (bribes: number) => {
  if (bribes === -1) return `(call block 4 or later)`
  if (bribes === -3) return `(Uniswap V3)`
  const index = state.prioBySnipes.findIndex(p => p[0] === bribes)
  const nextThreshold = state.prioBySnipes[index + 1]
  if (!nextThreshold) return `more than ${bribes} bribes`
  if (nextThreshold[0] === bribes + 1) return `${bribes} bribe${bribes > 1 ? 's' : ''}`
  return `between ${bribes} and ${nextThreshold[0] - 1} bribes`
}

const toggleHours = (dayIndex: number) => {
  const previous = state.hours[dayIndex][0]
  for (let h = 0; h <= 23; h++) {
    state.hours[dayIndex][h] = !previous
  }
}

const exportXlsx = async (logs: Log[]) => {
  if (!current.value) return
  const rowsToExport = getRowsCorrespondingToLogs(logs, current.value.caColumn, current.value.rows)
  await downloadRowsXlsx(rowsToExport, `${current.value.fileName.replace('.xlsx', '')} updated`)
}

const incStartDate = (inc = 1) => {
  const base = selection.startDate || filteredCalls.value[0]?.date || ''
  if (!base) return
  const offset = selection.startDate ? inc : 0
  const currentDate = new Date(base)
  currentDate.setDate(currentDate.getDate() + offset)
  selection.startDate = currentDate.toISOString().split('T')[0]
}
const incEndDate = (inc = 1) => {
  const base = selection.endDate || filteredCalls.value[filteredCalls.value.length - 1]?.date || ''
  if (!base) return
  const offset = selection.endDate ? inc : 1
  const currentDate = new Date(base)
  currentDate.setDate(currentDate.getDate() + offset)
  selection.endDate = currentDate.toISOString().split('T')[0]
}

const runCompute = async () => {
  if (!filteredCalls.value.length) return

  loading.value = true
  await sleep(0.2) // waiting for color transition on inputs

  return worker.value?.postMessage({
    type: 'COMPUTE',
    calls: JSON.parse(JSON.stringify(filteredCalls.value)),
    position: state.position,
    gweiDelta: state.gweiDelta,
    prioBySnipes: computedPrioBySnipes.value,
    buyTaxInXs: state.buyTaxInXs,
    feeInXs: state.feeInXs,
    chainApiKey: state.chainApiKey,
    takeProfits: JSON.parse(JSON.stringify(state.takeProfits)),
    withPriceImpact: state.withPriceImpact,
    withAccuracyAddy,
  })
}
const debouncedCompute = debounce(runCompute, 1000)
watch(filteredCalls, () => {
  if (!initialized.value) return
  loading.value = true
  debouncedCompute()
})
// reload when an input related to profit changes
watch(
  [
    () => state.position,
    () => state.takeProfits,
    () => state.gweiDelta,
    () => state.conditionalPrio,
    () => state.prioBySnipes,
    () => state.buyTaxInXs,
    () => state.feeInXs,
    () => state.chainApiKey,
    () => state.withPriceImpact,
  ],
  () => {
    debouncedCompute()
  },
  { deep: true },
)

const { timezoneOptions } = useTimezone()

const toast = useToast()
const errorMessage = (message: string) =>
  toast.add({
    severity: 'error',
    summary: 'Wrong format for targets collection',
    life: 10000,
  })

const buyInfo = `Final wallet worth, starting from 0.<ul><li>Buy calculations: Investing selected max bag or contract's max buy, minus tax, gas price (calculated from current+delta gwei) and, optionally, estimated slippage from on-chain data.</li><li>Sell calculations: ${SELL_GAS_PRICE} fixed gas price, ${SELL_TAX}% tax and, optinally, price impact, are removed from each sale.</li><li>Investment is counted as a loss if not reaching targets.</li><li>Each sale's date is guessed from sale MC vs. ATH MC ratio: on a 1 month 4m MC token, selling at 1m means selling after 1 week.</li></ul>`

const worker = shallowRef<Worker | null>(null)
onMounted(async () => {
  const WorkerConstructor = (await import('@/worker?worker')).default
  worker.value = new WorkerConstructor()
  worker.value!.onmessage = handleWorkerMessage
  worker.value!.onerror = ({ message }) => {
    error.value = message
  }
})

async function handleWorkerMessage({ data }: any) {
  if (data.type === 'XLSX') {
    uploading.value = Math.max(0, uploading.value - 1)
    return storeData(data.rows, data.fileName)
  } else if (data.type === 'COMPUTE') {
    finalWorth.value = data.finalWorth
    drawdown.value = data.drawdown
    volume.value = data.volume
    worstDrawdown.value = data.worstDrawdown
    counters.value = data.counters
    logs.value = data.logs
    hashes.value = data.hashes
    signatures.value = data.signatures
    gases.value = data.gases
    loading.value = false
  } else if (data.type === 'WARNING') {
    toast.removeAllGroups()
    toast.add({
      severity: 'warn',
      summary: data.text,
      life: 10000,
    })
  } else if (data.type === 'LOADING') {
    loading.value = data.text || false
  } else if (data.type === 'SCATTER') {
    accuracyLogs.value = data.accuracy
  }
}
</script>

<style scoped>
.flex-50 {
  flex: 1 1 50%;
}

.target-parent {
  position: relative;
}
.target-icon {
  opacity: 1;
}
.target-remove {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  height: 4rem;
}
.target-parent:hover .target-icon,
.target-parent:focus .target-icon,
.target-parent:active .target-icon {
  opacity: 0;
}
.target-parent:hover .target-remove,
.target-parent:focus .target-remove,
.target-parent:active .target-remove {
  opacity: 1;
}

.stickyButton {
  position: absolute;
  right: 0.5rem;
  top: 0.5rem;
  z-index: 2;
}
.stickyButton:focus,
.stickyButton:active {
  box-shadow: none !important;
  border-color: transparent !important;
}
</style>
