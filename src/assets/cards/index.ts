import type { InputCard } from "@/core";
import A1 from "./A1.json";
import A1a from "./A1a.json";
import A2 from "./A2.json";
import A2a from "./A2a.json";
import A2b from "./A2b.json";
import A3 from "./A3.json";
import A3a from "./A3a.json";
import A3b from "./A3b.json";
import A4 from "./A4.json";
import A4a from "./A4a.json";
import A4b from "./A4b.json";
import B1 from "./B1.json";
import B1a from "./B1a.json";
import B2 from "./B2.json";

const seriesA = { A1, A1a, A2, A2a, A2b, A3, A3a, A3b, A4, A4a, A4b };
const seriesB = { B1, B1a, B2 };
export const cardData = {
  ...seriesA,
  ...seriesB,
} as Record<string, InputCard[]>;

export const allCards = Object.values(cardData)
  .slice(0, 8)
  .reduce((acc, cardList) => {
    return acc.concat(cardList);
  }, [] as InputCard[]);
