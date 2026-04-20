import type { PlayingCardDescriptor } from "../Predicates";
import type { BasePlayerStatus } from "./PlayerStatus";

interface CannotPlayCardPlayerStatus extends BasePlayerStatus {
  type: "CannotPlayCard";
  cardCondition: PlayingCardDescriptor;
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
  | CannotPlayCardPlayerStatus
  | NextCoinFlipPlayerStatus
  | DummyPlayerStatus;

export const GameRulePlayerStatus = {
  CannotPlayCard: (cardCondition: PlayingCardDescriptor, keepNextTurn: boolean = true) => ({
    type: "CannotPlayCard",
    source: "Effect",
    cardCondition,
    keepNextTurn,
  }),
  NextCoinFlip: (result: boolean, keepNextTurn: boolean = true) => ({
    type: "NextCoinFlip",
    source: "Effect",
    result,
    keepNextTurn,
  }),
} satisfies Record<string, (...args: never) => GameRulePlayerStatus>;
