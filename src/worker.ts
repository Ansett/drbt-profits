import readXlsxFile from "read-excel-file/web-worker";
import type { Call, CallDiff } from "./types/Call";
import type { Log } from "./types/Log";
import type { TakeProfit } from "./types/TakeProfit";
import { prettifyDate, prettifyMc, round } from "./lib";
import type { HashInfo } from "./types/HashInfo";
import type {
  ComputationForTarget,
  ComputationResult,
  ComputationShortResult,
} from "./types/CpmputationResult";
import { ETH_PRICE, SELL_TAX, SELL_GAS_PRICE } from "./constants";

onmessage = function ({ data }) {
  if (!data?.type) return;

  if (data.type === "XLSX")
    return readXlsxFile(data.xlsx).then((rows) => {
      postMessage({ type: "XLSX", rows, fileName: data.xlsx.name });
    });
  if (data.type === "COMPUTE")
    return postMessage({ type: "COMPUTE", ...compute(data) });
  if (data.type === "TARGETING")
    return postMessage({ type: "TARGETING", result: findTarget(data) });
  if (data.type === "DIFF")
    return postMessage({
      type: "DIFF",
      diff: getCallsDiff(data.previousCalls, data.newCalls),
    });
};

const REALISTIC_MAX_XS = 10000;

const computeMaxETH = (currentMC: number, supply: number, maxBuy: number) => {
  const supplyBought = maxBuy * supply;
  return ((currentMC / supply) * supplyBought) / ETH_PRICE;
};

const getGasPrice = (call: Call, gweiDelta: number): number =>
  ((call.gwei + gweiDelta) / 1000000000) * call.buyGas;

function compute({
  calls,
  position,
  gweiDelta,
  takeProfits,
  buyTaxInXs,
}: {
  calls: Call[];
  position: number;
  gweiDelta: number;
  takeProfits: TakeProfit[];
  buyTaxInXs: boolean;
}): ComputationResult {
  let finalETH = 0;
  let drawdown = 0;
  let profitByDate: [string, number][] = [];
  let drawdownByDate: [string, number][] = [];
  const counters = {
    rug: 0,
    unrealistic: 0,
    postAth: 0,
    x100: 0,
    x50: 0,
    x10: 0,
  };
  const logs: Log[] = [];
  const hashes: Record<string, HashInfo> = {};
  const signatures: Record<string, HashInfo> = {};

  calls.forEach((call) => {
    const maxBuyETH = computeMaxETH(call.currentMC, call.supply, call.maxBuy);
    let invested = Math.min(maxBuyETH || position, position);
    if (Number.isNaN(invested)) {
      invested = position;
    }

    if (call.rug) counters.rug++;
    const unrealistic = !call.rug && call.xs > REALISTIC_MAX_XS;
    if (unrealistic) counters.unrealistic++;
    const postAth = !call.rug && call.ath <= call.callTimeAth;
    if (postAth) counters.postAth++;

    const gasPrice = getGasPrice(call, gweiDelta);
    let gain = -gasPrice - invested;
    // remove buy tax either directly on Xs, or later when calculating profit
    const buyTax = buyTaxInXs ? 1 : 1 - call.buyTax;
    const effectiveXs = call.xs * (buyTaxInXs ? 1 - call.buyTax : 1);

    const bestXs = unrealistic ? REALISTIC_MAX_XS : effectiveXs;
    const hitTp = [];

    if (!call.rug && !postAth) {
      let remainingPosition = 100;
      let tpIndex = 0;
      for (const tp of takeProfits) {
        const targetXsDirect = tp.withXs ? tp.xs : 0;
        const targetXsFromMc = tp.withMc ? (effectiveXs / call.ath) * tp.mc : 0;
        const firstTargetMet = !targetXsDirect
          ? targetXsFromMc
          : !targetXsFromMc
          ? targetXsDirect
          : Math.min(targetXsDirect, targetXsFromMc);

        if (bestXs >= firstTargetMet && tp.size) {
          gain +=
            ((invested * tp.size) / 100) *
              firstTargetMet *
              buyTax *
              (1 - SELL_TAX / 100) -
            SELL_GAS_PRICE;
          remainingPosition -= tp.size;
          hitTp.push("TP" + (tpIndex + 1));
        }
        if (remainingPosition <= 0) break;
        tpIndex++;
      }

      if (bestXs >= 100) counters.x100++;
      if (bestXs >= 50) counters.x50++;
      if (bestXs >= 10) counters.x10++;
    }

    finalETH += gain;
    if (finalETH < drawdown) drawdown = round(finalETH);
    profitByDate = [...profitByDate, [call.date, 0]];
    for (const p of profitByDate) {
      p[1] += gain;
    }
    drawdownByDate = [...drawdownByDate, [prettifyDate(call.date), 0]];
    for (const index in drawdownByDate) {
      if (profitByDate[index][1] < drawdownByDate[index][1])
        drawdownByDate[index][1] = round(profitByDate[index][1]);
    }

    // Regrouping hashes
    if (call.hashF) {
      if (!hashes[call.hashF]) hashes[call.hashF] = initHash(call.hashF);
      hashes[call.hashF].allCalls.push(call);
      if (call.rug) hashes[call.hashF].rugs++;
      if (call.xs >= 5 && !call.rug) hashes[call.hashF].perf.x5++;
      if (call.xs >= 10 && !call.rug) hashes[call.hashF].perf.x10++;
      if (call.xs >= 50 && !call.rug) hashes[call.hashF].perf.x50++;
      if (call.xs >= 100 && !call.rug) hashes[call.hashF].perf.x100++;
      hashes[call.hashF].xSum += call.rug ? 0 : call.xs;
    }

    // Regrouping function 4bytes signatures
    if (call.fList) {
      for (const id of call.fList.split(",")) {
        if (!signatures[id]) signatures[id] = initHash(id);
        signatures[id].allCalls.push(call);
        if (call.rug) signatures[id].rugs++;
        if (call.xs >= 5 && !call.rug) signatures[id].perf.x5++;
        if (call.xs >= 10 && !call.rug) signatures[id].perf.x10++;
        if (call.xs >= 50 && !call.rug) signatures[id].perf.x50++;
        if (call.xs >= 100 && !call.rug) signatures[id].perf.x100++;
        signatures[id].xSum += call.rug ? 0 : call.xs;
      }
    }

    logs.push({
      date: prettifyDate(call.date),
      ca: call.ca,
      name: call.name,
      xs: round(bestXs, 1),
      ath: call.ath,
      currentMC: call.currentMC,
      rug: call.rug,
      info: unrealistic ? "unrealistic" : postAth ? "post-ath" : "",
      invested: round(invested, 3),
      gasPrice: round(gasPrice, 3),
      gain: round(gain, 3),
      hitTp,
    });
  });

  // most recent first
  logs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return {
    finalETH: round(finalETH),
    drawdown: round(drawdown),
    worstDrawdown: drawdownByDate.reduce(
      (prev, cur) => (cur[1] < prev[1] ? cur : prev),
      ["", 0]
    ),
    counters,
    logs,
    hashes,
    signatures,
  };
}

function getCallsDiff(previousCalls: Call[], newCalls: Call[]): CallDiff[] {
  if (!previousCalls.length || !newCalls.length) return [];
  const diff = [] as CallDiff[];

  for (const call of newCalls) {
    diff.push({
      call,
      status: previousCalls.some((c) => c.ca === call.ca) ? "IN-BOTH" : "ADDED",
    });
  }
  for (const call of previousCalls) {
    if (newCalls.every((c) => c.ca !== call.ca))
      diff.push({ call, status: "REMOVED" });
  }

  return diff;
}

function initHash(id: string) {
  return {
    id,
    tags: [],
    perf: {
      x5: 0,
      x10: 0,
      x50: 0,
      x100: 0,
    },
    rugs: 0,
    xSum: 0,
    allCalls: [],
  };
}

function findTarget({
  calls,
  position,
  gweiDelta,
  targetStart,
  buyTaxInXs,
  end,
  increment,
}: {
  calls: Call[];
  position: number;
  gweiDelta: number;
  targetStart: TakeProfit;
  buyTaxInXs: boolean;
  end: number;
  increment: number;
}): ComputationForTarget[] {
  const withMc = targetStart.withMc;
  let currentTP = { ...targetStart };
  const inc = (): boolean => {
    const prop = withMc ? "mc" : "xs";
    currentTP[prop] += increment;
    return currentTP[prop] > end;
  };

  let ended = false;
  const results = [] as ComputationForTarget[];
  do {
    const { finalETH, drawdown, worstDrawdown } = compute({
      calls,
      position,
      gweiDelta,
      buyTaxInXs,
      takeProfits: [currentTP],
    });
    results.push({
      finalETH,
      drawdown,
      worstDrawdown,
      target: withMc ? `$${currentTP.mc}` : `${currentTP.xs}x`,
    });

    ended = inc();
  } while (!ended);

  return results;
}
