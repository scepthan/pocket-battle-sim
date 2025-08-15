import type { DeckInfo, InputCard } from "@/core";
import { default as cardData } from "./cards.json";
import { default as deckData } from "./decks.json";

export type DeckList = Record<string, DeckInfo>;
export type DeckRecord = Record<string, DeckList>;

export const cards = cardData as InputCard[];
export const decks = deckData as DeckRecord;

export const allDecks = Object.entries(decks).reduce((acc, [setName, deckList]) => {
  Object.entries(deckList).forEach(([deckName, deckInfo]) => {
    acc[`${setName} - ${deckName}`] = deckInfo;
  });
  return acc;
}, {} as DeckList);
