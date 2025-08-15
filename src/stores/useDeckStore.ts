import { allDecks, decks, type DeckRecord } from "@/assets";
import type { DeckInfo } from "@/core";
import { defineStore } from "pinia";
import { ref } from "vue";

export const useDeckStore = defineStore("decks", () => {
  const Decks = ref<DeckRecord>(decks);
  const AllDecks = ref<Record<string, DeckInfo>>(allDecks);

  console.log("Decks loaded:", Object.keys(Decks.value).length);

  return { Decks, AllDecks };
});
