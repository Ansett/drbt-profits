export type Call = {
  name: string;
  ca: string;
  nameAndCa: string; // for filtering
  date: string;
  price: number;
  callMc: number;
  xs: number;
  ath: number;
  callTimeAth: number;
  delay: number; // s
  fList: string;
  supply: number;
  maxBuy: number;
  currentMC: number;
  buyTax: number;
  rug: boolean;
  hashF: string;
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
