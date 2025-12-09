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

export const cardData = { A1, A1a, A2, A2a, A2b, A3, A3a, A3b, A4, A4a } as Record<
  string,
  InputCard[]
>;

export const allCards = Object.values(cardData)
  .slice(0, 6)
  .reduce((acc, cardList) => {
    return acc.concat(cardList);
  }, [] as InputCard[]);
