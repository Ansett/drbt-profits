export type Call = {
  name: string;
  ca: string;
  date: string;
  xs: number;
  ath: number;
  callTimeAth: number;
  delay: number; // s
  // athDelay: number; // s
  fList: string;
  supply: number;
  maxBuy: number;
  currentMC: number;
  buyTax: number;
  rug: boolean;
  hashF: string;
};

export type CallDiff = {
  call: Call;
  status: "added" | "removed";
};

export type CallArchive = {
  fileName: string;
  calls: Call[];
};
