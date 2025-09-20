import type { DeckInfo } from "@/core";
import A1 from "./A1.json";
import A1a from "./A1a.json";

export type DeckList = Record<string, DeckInfo>;
export type DeckRecord = Record<string, DeckList>;

export const decks = { ...A1, ...A1a } as Record<string, DeckList>;

export const allDecks = Object.entries(decks).reduce((acc, [setName, deckList]) => {
  Object.entries(deckList).forEach(([deckName, deckInfo]) => {
    acc[`${setName} - ${deckName}`] = deckInfo;
  });
  return acc;
}, {} as DeckList);
