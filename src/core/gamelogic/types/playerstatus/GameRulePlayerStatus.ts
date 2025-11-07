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

export type GameRulePlayerStatus = CannotUseSupporterPlayerStatus | CannotUseItemPlayerStatus;
