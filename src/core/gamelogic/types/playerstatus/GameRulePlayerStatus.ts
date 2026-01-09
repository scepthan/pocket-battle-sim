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

export const GameRulePlayerStatus = {
  CannotUseSupporter: (keepNextTurn: boolean = true) => ({
    type: "CannotUseSupporter",
    source: "Effect",
    keepNextTurn,
  }),
  CannotUseItem: (keepNextTurn: boolean = true) => ({
    type: "CannotUseItem",
    source: "Effect",
    keepNextTurn,
  }),
} satisfies Record<string, (...args: never) => GameRulePlayerStatus>;
