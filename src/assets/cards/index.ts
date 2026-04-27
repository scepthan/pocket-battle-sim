import type { InputCard } from "@/core";
import { seriesA } from "./A-Series";
import { seriesB } from "./B-Series";

export const cardData = {
  ...seriesA,
  ...seriesB,
} as Record<string, InputCard[]>;

export const allCards = Object.values(cardData).reduce((acc, cardList) => {
  return acc.concat(cardList);
}, [] as InputCard[]);
