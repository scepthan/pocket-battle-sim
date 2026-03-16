import type { BasePlayerStatus } from "./PlayerStatus";

interface CannotUseSupporterPlayerStatus extends BasePlayerStatus {
  type: "CannotUseSupporter";
}
interface CannotUseItemPlayerStatus extends BasePlayerStatus {
  type: "CannotUseItem";
}
interface NextCoinFlipPlayerStatus extends BasePlayerStatus {
  type: "NextCoinFlip";
  result: boolean;
}

// A dummy status so the v-else in the game log works correctly
interface DummyPlayerStatus extends BasePlayerStatus {
  type: "Dummy";
}

export type GameRulePlayerStatus =
  | CannotUseSupporterPlayerStatus
  | CannotUseItemPlayerStatus
  | NextCoinFlipPlayerStatus
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
  NextCoinFlip: (result: boolean, keepNextTurn: boolean = true) => ({
    type: "NextCoinFlip",
    source: "Effect",
    result,
    keepNextTurn,
  }),
} satisfies Record<string, (...args: never) => GameRulePlayerStatus>;
