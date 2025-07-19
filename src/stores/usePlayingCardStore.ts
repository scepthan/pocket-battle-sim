import { useCardParser } from "@/composables/useCardParser";
import type { InputCard, PlayingCard } from "@/types";
import { defineStore } from "pinia";
import { ref } from "vue";

export const usePlayingCardStore = defineStore("playing-cards", () => {
  const Cards = ref<PlayingCard[]>([]);
  const InputCards = ref<InputCard[]>([]);
  const cardLookup = ref<Record<string, PlayingCard>>({});

  const loading = ref(false);
  const promise = ref<Promise<void> | null>(null);

  const { parseCard } = useCardParser();

  const loadCards = async () => {
    if (promise.value) {
      return await promise.value;
    }

    loading.value = true;
    promise.value = new Promise(async (resolve) => {
      const inputCards = (await import("@/assets/cards.json"))
        .default as InputCard[];
      InputCards.value = inputCards;
      const outputCards: PlayingCard[] = [];

      let successCount = 0;
      let softFailCount = 0;
      for (const card of inputCards) {
        const parsed = parseCard(card);
        if (parsed.value) {
          outputCards.push(parsed.value);
          cardLookup.value[parsed.value.ID] = parsed.value;
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

      loading.value = false;
      promise.value = null;
      resolve();
    });
    await promise.value;
  };

  const ensureCardsLoaded = async () => {
    if (Cards.value.length === 0) {
      await loadCards();
    }
  };

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
    loadCards,
    ensureCardsLoaded,
    parseDeck,
    getCardById,
  };
});
