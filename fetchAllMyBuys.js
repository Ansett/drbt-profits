import { Alchemy, Network } from "alchemy-sdk";
import dotenv from "dotenv";
import { unlinkSync, existsSync, appendFileSync } from "fs";

dotenv.config();

const MY_ADDR = process.env.ETHER_ADDR;
const BANANA = "0x3328F7f4A1D1C57c35df56bBf0c9dCAFCA309C49";
const STARTING_BLOCK = 18721864; // 2023-12-05 19:15:26
const EXPORT_FILE = "buys.json";

const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API,
  network: Network.ETH_MAINNET,
});

const tokens = await alchemy.core.getAssetTransfers({
  fromBlock: STARTING_BLOCK,
  toAddress: MY_ADDR,
  category: ["erc20"],
});

const eth = await alchemy.core.getAssetTransfers({
  fromBlock: STARTING_BLOCK,
  fromAddress: MY_ADDR,
  category: ["external"],
});

const reimbursments = await alchemy.core.getAssetTransfers({
  fromBlock: STARTING_BLOCK,
  fromAddress: BANANA,
  toAddress: MY_ADDR,
  category: ["internal"],
});

const buys = tokens.transfers.reduce((arr, token) => {
  const tx = eth.transfers.find((tx) => tx.hash === token.hash);
  if (!tx) {
    // console.log("No TX for " + token.rawContract.address);
    return arr;
  }
  const reimbursement = reimbursments.transfers.find(
    (re) => re.hash === token.hash
  );

  arr.push({
    symbol: token.asset,
    ca: token.rawContract.address,
    amount: token.value,
    eth: tx.value - (reimbursement?.value || 0),
  });

  return arr;
}, []);

console.log(`${buys.length} transactions saved in ${EXPORT_FILE}`);

if (existsSync(EXPORT_FILE)) unlinkSync(EXPORT_FILE);
appendFileSync(EXPORT_FILE, JSON.stringify(buys), "utf8");
