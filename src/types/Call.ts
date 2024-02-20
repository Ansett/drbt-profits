export type Call = {
  name: string;
  ca: string;
  nameAndCa: string; // for filtering
  date: string;
  price: number;
  callMc: number;
  xs: number;
  ath: number;
  athDate: string;
  callTimeAth: number;
  delay: number; // s
  fList: string;
  supply: number;
  maxBuy: number;
  currentMC: number;
  buyTax: number;
  rug: boolean;
  hashF: string;
  gwei: number;
  buyGas: number;
  nbSnipes: number;
  snipesMinGwei: number;
  snipesMaxGwei: number;
  snipesAvgGwei: number;
  nbBribes: number;
  bribesMinEth: number;
  bribesMaxEth: number;
  bribesAvgEth: number;
  lp: number;
};

export type DiffType = "ADDED" | "REMOVED" | "IN-BOTH";
export type CallDiff = {
  call: Call;
  status: DiffType;
};

export type CallArchive = {
  fileName: string;
  calls: Call[];
};
