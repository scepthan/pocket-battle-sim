import type { BasePlayerStatus } from "./PlayerStatus";

interface CannotUseSupporterPlayerStatus extends BasePlayerStatus {
  type: "CannotUseSupporter";
}
interface CannotUseItemPlayerStatus extends BasePlayerStatus {
  type: "CannotUseItem";
}

// A dummy status so the v-else in the game log works correctly
interface DummyPlayerStatus extends BasePlayerStatus {
  type: "Dummy";
}

export type GameRulePlayerStatus =
  | CannotUseSupporterPlayerStatus
  | CannotUseItemPlayerStatus
  | DummyPlayerStatus;
