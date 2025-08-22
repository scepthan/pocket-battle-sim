import type { BattleRecord } from "./BattleRecord";

export interface MassSimulatorWorkerMessage {
  type: "matchupProgress" | "matchupComplete";
  matchup: BattleRecord;
  firstDeck: string;
  secondDeck: string;
}
