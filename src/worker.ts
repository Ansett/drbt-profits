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
  takeProfit1,
  takeProfit2,
}: {
  calls: Call[];
  position: number;
  gasPrice: number;
  takeProfit1: TakeProfit;
  takeProfit2: TakeProfit;
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

    const targetXs1 = takeProfit1.fixed
      ? (call.xs / call.ath) * takeProfit1.mc
      : takeProfit1.xs;
    const targetXs2 = takeProfit2.fixed
      ? (call.xs / call.ath) * takeProfit2.mc
      : takeProfit2.xs;

    if (!call.rug && !postAth) {
      if (bestXs >= targetXs1 && takeProfit1.size) {
        gain +=
          ((invested * takeProfit1.size) / 100) * targetXs1 * (1 - SELL_TAX) -
          gasPrice;
      }
      if (bestXs >= targetXs2 && takeProfit2.size) {
        gain +=
          ((invested * takeProfit2.size) / 100) * targetXs2 * (1 - SELL_TAX) -
          gasPrice;
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
      if (!hashes[call.hashF])
        hashes[call.hashF] = {
          id: call.hashF,
          tags: [],
          x10Calls: [],
          x50Calls: [],
          rugs: 0,
          xSum: 0,
          allCalls: [],
        };
      hashes[call.hashF].allCalls.push(call);
      if (call.rug) hashes[call.hashF].rugs++;
      if (call.xs >= 10 && !call.rug) hashes[call.hashF].x10Calls.push(call);
      if (call.xs >= 50 && !call.rug) hashes[call.hashF].x50Calls.push(call);
      hashes[call.hashF].xSum += call.rug ? 0 : call.xs;
    }

    // Regrouping function 4bytes signatures
    if (call.fList) {
      for (const id of call.fList.split(",")) {
        if (!signatures[id])
          signatures[id] = {
            id,
            tags: [],
            x10Calls: [],
            x50Calls: [],
            rugs: 0,
            xSum: 0,
            allCalls: [],
          };
        signatures[id].allCalls.push(call);
        if (call.rug) signatures[id].rugs++;
        if (call.xs >= 10 && !call.rug) signatures[id].x10Calls.push(call);
        if (call.xs >= 50 && !call.rug) signatures[id].x50Calls.push(call);
        signatures[id].xSum += call.rug ? 0 : call.xs;
      }
    }

    logs.push({
      date: prettifyDate(call.date),
      ca: call.ca,
      name: call.name,
      xs: round(bestXs, 1),
      mc: prettifyMc(call.ath),
      info: call.rug
        ? "RUG"
        : unrealistic
        ? `capped Xs`
        : postAth
        ? "post-ATH"
        : "",
      invested: round(invested, 3),
      gain: round(gain, 3),
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
