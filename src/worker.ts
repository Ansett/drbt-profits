import readXlsxFile from "read-excel-file/web-worker";
import type { Call } from "./types/Call";
import type { Log } from "./types/Log";

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

const computeMaxETH = (currentMC: number, supply: number, maxBuy: number) => {
  const supplyBought = maxBuy * supply;
  return ((currentMC / supply) * supplyBought) / ETH_PRICE;
};

function compute({
  calls,
  position,
  gasPrice,
  takeProfit,
}: {
  calls: Call[];
  position: number;
  gasPrice: number;
  takeProfit: number;
}) {
  let finalETH = 0;
  let drawdown = 0;
  let postATHCount = 0;
  const logs: Log[] = [];

  calls.forEach((call) => {
    const maxBuyETH = computeMaxETH(call.currentMC, call.supply, call.maxBuy);
    let invested = Math.min(maxBuyETH || position, position);
    if (Number.isNaN(invested)) {
      invested = position;
    }
    let gain = -gasPrice - invested;
    if (call.athDelay <= call.delay) {
      postATHCount++;
      return;
    }

    const xs = call.xs; // / (1 + entrySlippage);
    if (xs >= takeProfit) {
      gain +=
        ((invested * 100) / 100) *
          takeProfit *
          // (1 - call.buyTax) * // not accounting for tax because it's included in DRBT CallToATH_X
          (1 - SELL_TAX) -
        gasPrice;
    }

    finalETH += gain;
    if (finalETH < drawdown) drawdown = finalETH;

    logs.push({
      date: call.date.replace(".000Z", ""),
      ca: call.ca,
      name: call.name,
      xs: call.xs,
      invested: Math.round(invested * 1000) / 1000,
      gain: Math.round(gain * 1000) / 1000,
    });
  });

  return {
    finalETH: Math.round(finalETH * 100) / 100,
    drawdown: Math.round(drawdown * 100) / 100,
    postATHCount,
    logs,
  };
}
