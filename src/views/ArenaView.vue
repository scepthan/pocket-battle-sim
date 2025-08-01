<template>
  <PlayingField
    v-if="cardStore.Cards.length > 0"
    :game="game"
    :shown-players="['Player']"
  />
</template>

<script setup lang="ts">
import { GameState } from "@/models/GameState";
import { BetterRandomAgent, RandomAgent } from "@/models/agents";
import { useDeckStore, usePlayingCardStore } from "@/stores";
import type { DeckInfo } from "@/types";
import { onMounted, ref } from "vue";

const cardStore = usePlayingCardStore();
const deckStore = useDeckStore();

const prebuiltDecks: Record<string, DeckInfo> = {
  Celebi1: {
    Cards: [
      "A1a-004",
      "A1a-004",
      "A1a-005",
      "A1a-005",
      "A1a-009",
      "A1a-070",
      "A1a-070",
      "A1a-075",
      "A1a-085",
      "PROMO-001",
      "PROMO-002",
      "PROMO-005",
      "PROMO-005",
      "PROMO-007",
      "PROMO-007",
      "A1-219",
      "A1-219",
      "A1-225",
      "A1a-068",
      "A1a-081",
    ],
    EnergyTypes: ["Grass"],
  },
  Alakazam1: {
    Cards: [
      "A1-115",
      "A1-115",
      "A1-130",
      "A1-116",
      "A1-116",
      "A1-131",
      "A1a-033",
      "A1-132",
      "A1-236",
      "A1-236",
      "PROMO-001",
      "PROMO-002",
      "PROMO-002",
      "PROMO-005",
      "PROMO-005",
      "PROMO-007",
      "PROMO-007",
      "A1-223",
      "A1-225",
      "A1a-081",
    ],
    EnergyTypes: ["Psychic"],
  },
};

const player = ref<RandomAgent>();
const opponent = ref<RandomAgent>();
const game = ref<GameState>();

onMounted(async () => {
  await deckStore.ensureDecksLoaded();
  const importedDecks = deckStore.Decks;

  const allDecks = { ...importedDecks.A1, ...prebuiltDecks };
  const deckNames = Object.keys(allDecks) as (keyof typeof allDecks)[];
  let newGameCountdown = 0;

  // For testing purposes, you can set playerDeck and opponentDeck to specific deck names
  // Otherwise, they will be selected at random from the available decks
  const playerDeck: string | undefined = undefined;
  const opponentDeck: string | undefined = undefined;

  setInterval(() => {
    if (game.value && !game.value.GameOver) return;
    if (newGameCountdown > 0) return newGameCountdown--;

    newGameCountdown = 10;
    const deck1 =
      playerDeck || deckNames[Math.floor(Math.random() * deckNames.length)];
    const deck2 =
      opponentDeck || deckNames[Math.floor(Math.random() * deckNames.length)];

    player.value = new BetterRandomAgent("Player", allDecks[deck1]);
    opponent.value = new BetterRandomAgent("Opponent", allDecks[deck2]);

    game.value = new GameState(player.value, opponent.value, {
      DelayPerAction: 1000,
    });

    setTimeout(async () => {
      if (!game.value) return;

      void game.value.start();
    }, 3000);
  }, 1000);
});
</script>
