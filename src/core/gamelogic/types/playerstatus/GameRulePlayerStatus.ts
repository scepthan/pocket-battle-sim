import type { BasePlayerStatus } from "./PlayerStatus";

interface BaseGameRulePlayerStatus extends BasePlayerStatus {
  category: "GameRule";
}

interface CannotUseSupporterPlayerStatus extends BaseGameRulePlayerStatus {
  type: "CannotUseSupporter";
}
interface CannotUseItemPlayerStatus extends BaseGameRulePlayerStatus {
  type: "CannotUseItem";
}

// A dummy status so the v-else in the game log works correctly
interface DummyPlayerStatus extends BaseGameRulePlayerStatus {
  type: "Dummy";
}

export type GameRulePlayerStatus =
  | CannotUseSupporterPlayerStatus
  | CannotUseItemPlayerStatus
  | DummyPlayerStatus;
