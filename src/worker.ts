import readXlsxFile from "read-excel-file/web-worker";
import type { Call } from "./types/Call";
import type { Log } from "./types/Log";
import type { TakeProfit } from "./types/TakeProfit";
import { prettifyDate, round } from "./lib";

onmessage = function ({ data }) {
  if (!data?.type) return;

  if (data.type === "XLSX")
    return readXlsxFile(data.xlsx).then((rows) => {
      postMessage({ type: "XLSX", rows });
    });
  if (data.type === "COMPUTE")
    return postMessage({ type: "COMPUTE", ...compute(data) });
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
  let unrealisticCount = 0;
  let postAthCount = 0;
  let rugCount = 0;
  const logs: Log[] = [];

  calls.forEach((call) => {
    const maxBuyETH = computeMaxETH(call.currentMC, call.supply, call.maxBuy);
    let invested = Math.min(maxBuyETH || position, position);
    if (Number.isNaN(invested)) {
      invested = position;
    }
    if (call.rug) rugCount++;
    const unrealistic = !call.rug && call.xs > REALISTIC_MAX_XS;
    if (unrealistic) unrealisticCount++;
    const postAth = !call.rug && call.ath <= call.callTimeAth;
    if (postAth) postAthCount++;

    let gain = -gasPrice - invested;

    const computeXs = (mc: number) => mc / (call.currentMC * (1 + call.buyTax)); // / (1 + entrySlippage);
    const maxXs = unrealistic ? REALISTIC_MAX_XS : computeXs(call.ath);
    const targetXs1 = takeProfit1.fixed
      ? computeXs(takeProfit1.mc)
      : takeProfit1.xs;
    const targetXs2 = takeProfit2.fixed
      ? computeXs(takeProfit2.mc)
      : takeProfit2.xs;

    if (!call.rug && !postAth) {
      if (maxXs >= targetXs1) {
        gain +=
          ((invested * takeProfit1.size) / 100) * targetXs1 * (1 - SELL_TAX) -
          gasPrice;
      }
      if (!call.rug && maxXs >= targetXs2) {
        gain +=
          ((invested * takeProfit2.size) / 100) * targetXs2 * (1 - SELL_TAX) -
          gasPrice;
      }
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

    logs.push({
      date: prettifyDate(call.date),
      ca: call.ca,
      name: call.name,
      xs: round(maxXs, 1),
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
    unrealisticCount,
    postAthCount,
    rugCount,
    logs,
  };
}
