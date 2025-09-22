import type { Deck } from "./Deck";

export interface GameRules {
  DeckSize: number;
  InitialHandSize: number;
  MaxHandSize: number;
  PrizePoints: number;
  TurnLimit: number;
  DelayPerAction: number;
  ExtraValidation?: (deck: Deck) => true | string;
}
