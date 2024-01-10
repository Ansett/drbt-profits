import readXlsxFile from "read-excel-file/web-worker";
import type { Call, CallDiff } from "./types/Call";
import type { Log } from "./types/Log";
import type { TakeProfit } from "./types/TakeProfit";
import { prettifyDate, prettifyMc, round } from "./lib";
import type { HashInfo } from "./types/HashInfo";

onmessage = function ({ data }) {
  if (!data?.type) return;

  if (data.type === "XLSX")
    return readXlsxFile(data.xlsx).then((rows) => {
      postMessage({ type: "XLSX", rows, fileName: data.xlsx.name });
    });
  if (data.type === "COMPUTE")
    return postMessage({ type: "COMPUTE", ...compute(data) });
  if (data.type === "DIFF")
    return postMessage({
      type: "DIFF",
      diff: getCallsDiff(data.previousCalls, data.newCalls),
    });
};

const SELL_TAX = 5 / 100;
const ETH_PRICE = 2000;
const REALISTIC_MAX_XS = 10000;

const computeMaxETH = (currentMC: number, supply: number, maxBuy: number) => {
  const supplyBought = maxBuy * supply;
  return ((currentMC / supply) * supplyBought) / ETH_PRICE;
};

function compute({
  calls,
  position,
  gasPrice,
  takeProfits,
}: {
  calls: Call[];
  position: number;
  gasPrice: number;
  takeProfits: TakeProfit[];
}) {
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

    let gain = -gasPrice - invested;
    const bestXs = unrealistic ? REALISTIC_MAX_XS : call.xs;
    const hitTp = [];

    if (!call.rug && !postAth) {
      let remainingPosition = 100;
      let tpIndex = 0;
      for (const tp of takeProfits) {
        const targetXsDirect = tp.withXs ? tp.xs : 0;
        const targetXsFromMc = tp.withMc ? (call.xs / call.ath) * tp.mc : 0;
        const firstTargetMet = !targetXsDirect
          ? targetXsFromMc
          : !targetXsFromMc
          ? targetXsDirect
          : Math.min(targetXsDirect, targetXsFromMc);

        if (bestXs >= firstTargetMet && tp.size) {
          gain +=
            ((invested * tp.size) / 100) * firstTargetMet * (1 - SELL_TAX) -
            gasPrice;
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
      rug: call.rug,
      info: unrealistic ? "unrealistic" : postAth ? "post-ath" : "",
      invested: round(invested, 3),
      gain: round(gain, 3),
      hitTp,
    });
  });

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
    if (previousCalls.every((c) => c.ca !== call.ca))
      diff.push({ call, status: "added" });
  }
  for (const call of previousCalls) {
    if (newCalls.every((c) => c.ca !== call.ca))
      diff.push({ call, status: "removed" });
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
