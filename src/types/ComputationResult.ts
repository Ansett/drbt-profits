import type { HashInfo } from "./HashInfo";
import type { Log } from "./Log";

export type ComputationShortResult = {
  finalETH: number;
  drawdown: number;
  worstDrawdown: [string, number];
};

export type ComputationForTarget = ComputationShortResult & {
  target: string;
};

export type ComputationResult = ComputationShortResult & {
  counters: {
    rug: number;
    unrealistic: number;
    postAth: number;
    x100: number;
    x50: number;
    x10: number;
  };
  logs: Log[];
  hashes: Record<string, HashInfo>;
  signatures: Record<string, HashInfo>;
};
