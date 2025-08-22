import type { BattleRecord } from "./BattleRecord";

export interface MassSimulatorFromWorkerMessage {
  type: "matchupProgress" | "matchupComplete";
  matchup: BattleRecord;
  firstDeck: string;
  secondDeck: string;
}
