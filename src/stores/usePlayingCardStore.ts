import { useCardParser } from "@/composables/useCardParser";
import type { InputCard } from "@/types/InputCard.js";
import type { PlayingCard } from "@/types/PlayingCard.js";
import { defineStore } from "pinia";
import { ref } from "vue";

export const usePlayingCardStore = defineStore("playing-cards", () => {
  const Cards = ref<PlayingCard[]>([]);

  const { parseCard } = useCardParser();

  const loadCards = async () => {
    const inputCards = (await import("@/assets/cards.json"))
      .default as InputCard[];
    const outputCards: PlayingCard[] = [];

    let successCount = 0;
    let softFailCount = 0;
    for (const card of inputCards) {
      const parsed = parseCard(card);
      if (parsed.value) {
        outputCards.push(parsed.value);
        successCount++;
      }
      if (!parsed.parseSuccessful) {
        console.log("Failed to parse card:", card, parsed.value);
        if (parsed.value) {
          successCount--;
          softFailCount++;
        }
      }
    }
    console.log(
      `${inputCards.length} cards found: ${successCount} successfully parsed, ${softFailCount} soft failed`
    );
    console.log(outputCards);
    Cards.value = outputCards;
  };

  const parseDeck = (cardIds: string[]) => {
    const deck: PlayingCard[] = [];

    for (const cardId of cardIds) {
      const card = Cards.value.find((c) => c.ID == cardId);
      if (card) {
        deck.push(card);
      } else {
        console.warn("Could not find card with ID " + cardId);
      }
    }

    return deck;
  };

  return { Cards, loadCards, parseDeck };
});
