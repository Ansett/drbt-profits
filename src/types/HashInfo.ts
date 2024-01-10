import type { Call } from "./Call";

export type HashInfo = {
  id: string;
  tags: string[];
  rugs: number;
  xSum: number;
  perf: {
    x5: number;
    x10: number;
    x50: number;
    x100: number;
  };
  allCalls: Call[];
};
