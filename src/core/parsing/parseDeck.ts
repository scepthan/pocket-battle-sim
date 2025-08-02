import inputCards from "@/assets/cards.json";
import { parseCard, type InputCard, type PlayingCard } from "@/core";

const outputCards: Record<string, PlayingCard> = {};

export const parseDeck = (cardIds: string[]) => {
  const deck: PlayingCard[] = [];

  for (const cardId of cardIds) {
    if (!(cardId in outputCards)) {
      const inputCard = inputCards.find((card) => card.ID == cardId);
      if (inputCard) {
        const card = parseCard(inputCard as InputCard).value;
        if (card !== undefined) {
          outputCards[cardId] = card;
        } else {
          throw new Error("Could not parse card with ID " + cardId);
        }
      } else {
        throw new Error("Could not find card with ID " + cardId);
      }
    }

    deck.push(Object.assign({}, outputCards[cardId]));
  }

  return deck;
};
