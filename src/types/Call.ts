export type Call = {
  name: string;
  ca: string;
  date: string;
  xs: number;
  ath: number;
  callTimeAth: number;
  delay: number; // s
  // athDelay: number; // s
  supply: number;
  maxBuy: number;
  currentMC: number;
  buyTax: number;
  rug: boolean;
};
