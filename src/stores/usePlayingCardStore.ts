import { allCards as inputCards } from "@/assets";
import { parseCard, type InputCard, type PlayingCard } from "@/core";
import { defineStore } from "pinia";

export const usePlayingCardStore = defineStore("playing-cards", () => {
  const Cards = ref<PlayingCard[]>([]);
  const InputCards = ref<InputCard[]>(inputCards);
  const cardLookup = ref<Record<string, PlayingCard>>({});

  const outputCards: PlayingCard[] = [];

  let successCount = 0;
  let softFailCount = 0;
  let hardFailCount = 0;
  for (const card of inputCards) {
    const parsed = parseCard(card);
    if (parsed.value) {
      outputCards.push(parsed.value);
      cardLookup.value[parsed.value.id] = parsed.value;
      successCount++;
    }
    if (!parsed.parseSuccessful) {
      if (parsed.value) {
        console.log("Failed to fully parse card:", card, parsed.value);
        successCount--;
        softFailCount++;
      } else {
        console.error("Could not parse card:", card);
        hardFailCount++;
      }
    }
  }
  let message = `${inputCards.length} cards found: ${successCount} successfully parsed`;
  if (softFailCount > 0) message += `, ${softFailCount} soft failed`;
  if (hardFailCount > 0) {
    console.error(message + `, ${hardFailCount} hard failed`);
  } else {
    console.log(message);
  }

  Cards.value = outputCards;

  const parseDeck = (cardIds: string[]) => {
    const deck: PlayingCard[] = [];

    for (const cardId of cardIds) {
      const card = cardLookup.value[cardId];
      if (card) {
        deck.push(Object.assign({}, card));
      } else {
        throw new Error("Could not find card with ID " + cardId);
      }
    }

    return deck;
  };

  const getCardById = (cardId: string): PlayingCard | undefined => {
    // Helper function to get a card by its ID
    const card = cardLookup.value[cardId];
    if (!card) {
      console.warn(`Card with ID ${cardId} not found`);
      return undefined;
    }
    return card;
  };

  return {
    Cards,
    InputCards,
    parseDeck,
    getCardById,
  };
});
