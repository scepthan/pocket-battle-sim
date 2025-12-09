<template>
  <div v-if="!game" class="h-100 d-flex flex-column justify-center align-center ga-4">
    <div class="d-flex ga-8 justify-center align-center">
      <div class="d-flex flex-column align-center ga-2">
        Your deck:
        <PlayerDeckSelector v-model:deck="playerDeck" v-model:deck-name="playerDeckName" />
      </div>
      <div class="pt-8">vs.</div>
      <div class="d-flex flex-column align-center ga-2">
        Opponent's deck:
        <PlayerDeckSelector v-model:deck="opponentDeck" v-model:deck-name="opponentDeckName" />
      </div>
    </div>

    <v-btn color="green" @click="startGame">Go</v-btn>
  </div>

  <PlayingField
    v-else
    v-model:agent="player"
    :game-view="gameView"
    :log="game?.GameLog"
    @play-again="startGame"
    @change-decks="game = undefined"
  />
</template>

<script setup lang="ts">
import {
  BetterRandomAgent,
  type DeckInfo,
  Game,
  PlayerAgent,
  PlayerGameView,
  randomElement,
} from "@/core";
import { useDeckStore } from "@/stores";

const deckStore = useDeckStore();

const player = ref<PlayerAgent>();
const opponent = ref<PlayerAgent>();
const game = ref<Game>();
const gameView = ref<PlayerGameView>();

const playerDeckName = ref<string>();
const opponentDeckName = ref<string>();
const playerDeck = ref<DeckInfo>();
const opponentDeck = ref<DeckInfo>();

const findDeck = (deckName: string) => {
  let deck = deckStore.BuiltinDecks[deckName];
  if (deckName.startsWith("Custom - ")) {
    const customDeckName = deckName.replace("Custom - ", "");
    deck = deckStore.CustomDecks[customDeckName];
  }
  if (!deck) throw new Error("Could not find deck: " + deckName);
  return deck;
};

const startGame = () => {
  const allDecks = deckStore.BuiltinDecks;
  const deckNames = Object.keys(allDecks) as (keyof typeof allDecks)[];

  const deck1 = playerDeck.value || findDeck(randomElement(deckNames));
  const deck2 = opponentDeck.value || findDeck(randomElement(deckNames));

  player.value = new BetterRandomAgent("Player", deck1);
  opponent.value = new BetterRandomAgent("Opponent", deck2);

  game.value = new Game(player.value, opponent.value, {
    DelayPerAction: 1000,
  });

  gameView.value = new PlayerGameView(game.value, game.value.Player1);

  setTimeout(async () => {
    if (!game.value) return;

    void game.value.start();
  }, 0);
};
</script>
