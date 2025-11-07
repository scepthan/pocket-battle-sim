import { allCards as inputCards } from "@/assets";
import type { PlayingCard } from "../gamelogic";
import { parseCard } from "./parseCard";

export const parseDeck = (cardIds: string[]) => {
  const deck: PlayingCard[] = [];

  for (const cardId of cardIds) {
    const inputCard = inputCards.find((card) => card.id == cardId);
    if (!inputCard) throw new Error("Could not find card with ID " + cardId);

    const card = parseCard(inputCard).value;
    if (card === undefined) throw new Error("Could not parse card with ID " + cardId);

    deck.push(card);
  }

  return deck;
};
