import type { Deck } from "./Deck";

export interface GameRules {
  DeckSize: number;
  InitialHandSize: number;
  MaxHandSize: number;
  TurnLimit: number;
  ExtraValidation?: (deck: Deck) => true | string;
}
