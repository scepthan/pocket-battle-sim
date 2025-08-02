import type { DeckInfo } from "@/core";
import { defineStore } from "pinia";
import { ref } from "vue";

type DeckRecord = Record<string, Record<string, DeckInfo>>;

export const useDeckStore = defineStore("decks", () => {
  const Decks = ref<DeckRecord>({});
  const loading = ref(false);
  const promise = ref<Promise<void> | null>(null);

  const loadDecks = async () => {
    if (promise.value) {
      return await promise.value;
    }

    loading.value = true;
    promise.value = new Promise(async (resolve, reject) => {
      try {
        const importedDecks = (await import("@/assets/decks.json")).default as DeckRecord;

        Decks.value = importedDecks;
        console.log("Decks loaded:", Object.keys(Decks.value).length);
      } catch (error) {
        console.error("Failed to load decks:", error);
        reject(error);
      } finally {
        loading.value = false;
        promise.value = null;
        resolve();
      }
    });

    await promise.value;
  };

  const ensureDecksLoaded = async () => {
    if (Object.keys(Decks.value).length === 0) {
      await loadDecks();
    }
  };

  return { Decks, loading, loadDecks, ensureDecksLoaded };
});
