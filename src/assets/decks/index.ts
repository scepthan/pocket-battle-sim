import type { DeckInfo } from "@/core";
import A1 from "./A1.json";
import A1a from "./A1a.json";
import A2 from "./A2.json";
import A2a from "./A2a.json";
import A2b from "./A2b.json";
import A3 from "./A3.json";
import A3a from "./A3a.json";
import A3b from "./A3b.json";

export type DeckList = Record<string, DeckInfo>;
export type DeckRecord = Record<string, DeckList>;

export const decks = { ...A3b, ...A3a, ...A3, ...A2b, ...A2a, ...A2, ...A1a, ...A1 } as DeckRecord;

export const allDecks = Object.entries(decks).reduce((acc, [setName, deckList]) => {
  Object.entries(deckList).forEach(([deckName, deckInfo]) => {
    acc[`${setName} - ${deckName}`] = deckInfo;
  });
  return acc;
}, {} as DeckList);
