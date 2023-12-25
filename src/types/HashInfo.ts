import type { Call } from "./Call";

export type HashInfo = {
  id: string;
  tags: string[];
  rugs: number;
  xSum: number;
  x10Calls: Call[];
  x50Calls: Call[];
  allCalls: Call[];
};
