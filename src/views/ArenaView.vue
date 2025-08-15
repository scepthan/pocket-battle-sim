<template>
  <PlayingField v-if="cardStore.Cards.length > 0" :game="game" :shown-players="['Player']" />
</template>

<script setup lang="ts">
import { BetterRandomAgent, Game, RandomAgent, randomElement } from "@/core";
import { useDeckStore, usePlayingCardStore } from "@/stores";
import { onMounted, ref } from "vue";

const cardStore = usePlayingCardStore();
const deckStore = useDeckStore();

const player = ref<RandomAgent>();
const opponent = ref<RandomAgent>();
const game = ref<Game>();

onMounted(() => {
  const allDecks = deckStore.AllDecks;
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
    const deck1 = playerDeck || randomElement(deckNames);
    const deck2 = opponentDeck || randomElement(deckNames);

    player.value = new BetterRandomAgent("Player", allDecks[deck1]);
    opponent.value = new BetterRandomAgent("Opponent", allDecks[deck2]);

    game.value = new Game(player.value, opponent.value, {
      DelayPerAction: 1000,
    });

    setTimeout(async () => {
      if (!game.value) return;

      void game.value.start();
    }, 3000);
  }, 1000);
});
</script>
