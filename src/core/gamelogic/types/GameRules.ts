import type { Deck } from "../../types";

export interface GameRules {
  DeckSize: number;
  InitialHandSize: number;
  MaxHandSize: number;
  TurnLimit: number;
  DelayPerAction: number;
  ExtraValidation?: (deck: Deck) => true | string;
}
