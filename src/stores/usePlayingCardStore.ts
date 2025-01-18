import type { InputCard } from "@/types/InputCard.js";
import type { PlayingCard } from "@/types/PlayingCard.js";
import { defineStore } from "pinia";
import { ref } from "vue";

export const usePlayingCardStore = defineStore("playing-cards", () => {
  const Cards = ref<PlayingCard[]>([]);

  const loadCards = async () => {
    const inputCards = (await import("@/assets/cards.json"))
      .default as InputCard[];

    console.log(inputCards);
  };

  return { Cards, loadCards };
});
