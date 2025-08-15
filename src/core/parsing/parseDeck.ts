import { cards as inputCards } from "@/assets";
import type { PlayingCard } from "../gamelogic";
import { parseCard } from "./parseCard";

const outputCards: Record<string, PlayingCard> = {};

export const parseDeck = (cardIds: string[]) => {
  const deck: PlayingCard[] = [];

  for (const cardId of cardIds) {
    if (!(cardId in outputCards)) {
      const inputCard = inputCards.find((card) => card.ID == cardId);
      if (!inputCard) throw new Error("Could not find card with ID " + cardId);

      const card = parseCard(inputCard).value;
      if (card === undefined) throw new Error("Could not parse card with ID " + cardId);

      outputCards[cardId] = card;
    }

    deck.push(Object.assign({}, outputCards[cardId]));
  }

  return deck;
};
