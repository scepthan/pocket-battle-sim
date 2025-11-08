<template>
  <PlayingField v-if="cardStore.Cards.length > 0" :game="game" :shown-players="['Player']" />
</template>

<script setup lang="ts">
import { BetterRandomAgent, Game, RandomAgent, randomElement } from "@/core";
import { useDeckStore, usePlayingCardStore } from "@/stores";

const cardStore = usePlayingCardStore();
const deckStore = useDeckStore();

const player = ref<RandomAgent>();
const opponent = ref<RandomAgent>();
const game = ref<Game>();

onMounted(() => {
  const allDecks = deckStore.AllDecks;
  const deckNames = Object.keys(allDecks) as (keyof typeof allDecks)[];
  const findDeck = (deckName: string) => {
    const deck = allDecks[deckName];
    if (!deck) throw new Error("Could not find deck: " + deckName);
    return deck;
  };

  let newGameCountdown = 0;

  // For testing purposes, you can set playerDeck and opponentDeck to specific deck names
  // Otherwise, they will be selected at random from the available decks
  const playerDeck: string | undefined = undefined;
  const opponentDeck: string | undefined = undefined;

  setInterval(() => {
    if (game.value && !game.value.GameOver) return;
    if (newGameCountdown > 0) return newGameCountdown--;

    newGameCountdown = 10;
    const deck1 = findDeck(playerDeck || randomElement(deckNames));
    const deck2 = findDeck(opponentDeck || randomElement(deckNames));

    player.value = new BetterRandomAgent("Player", deck1);
    opponent.value = new BetterRandomAgent("Opponent", deck2);

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
