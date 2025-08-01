import inputCards from "@/assets/cards.json";
import type { InputCard, PlayingCard } from "@/types";
import { useCardParser } from "./useCardParser";

const { parseCard } = useCardParser();

export const useDeckParser = () => {
  const outputCards = inputCards
    .map((card) => parseCard(card as InputCard).value)
    .filter((x) => x !== undefined);

  const cardLookup = Object.fromEntries(outputCards.map((card) => [card.ID, card]));

  const parseDeck = (cardIds: string[]) => {
    const deck: PlayingCard[] = [];

    for (const cardId of cardIds) {
      const card = cardLookup[cardId];
      if (card) {
        deck.push(Object.assign({}, card));
      } else {
        throw new Error("Could not find card with ID " + cardId);
      }
    }

    return deck;
  };

  return { parseDeck };
};
