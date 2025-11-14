import { allDecks, decks, type DeckRecord } from "@/assets";
import type { DeckInfo } from "@/core";
import { defineStore } from "pinia";

export const useDeckStore = defineStore("decks", () => {
  const BuiltinDecklists = ref<DeckRecord>(decks);
  const BuiltinDecks = ref<Record<string, DeckInfo>>(allDecks);

  console.log("Pre-built decks loaded:", Object.keys(BuiltinDecks.value).length);

  const CustomDecks = ref<Record<string, DeckInfo>>({});

  const storedDecks = localStorage.getItem("customDecks");
  if (storedDecks) {
    try {
      CustomDecks.value = JSON.parse(storedDecks);
      console.log("Custom decks loaded:", Object.keys(CustomDecks.value).length);
    } catch (e) {
      console.error("Failed to parse custom decks from localStorage:", e);
    }
  } else {
    console.log("No custom deck data found in localStorage.");
    localStorage.setItem("customDecks", JSON.stringify({}));
  }

  const saveCustomDecks = () => {
    localStorage.setItem("customDecks", JSON.stringify(CustomDecks.value));
    console.log("Custom decks saved:", Object.keys(CustomDecks.value).length);
  };

  return { BuiltinDecklists, BuiltinDecks, CustomDecks, saveCustomDecks };
});
