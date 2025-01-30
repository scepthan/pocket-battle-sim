<template>
  <v-container fluid>
    <div class="d-flex flex-column align-center">
      <div class="d-flex flex-column align-center ga-2 mb-6">
        <v-row no-gutters class="align-center">
          <InPlayCardSlot :card="game?.Player1.ActivePokemon" />
        </v-row>
        <v-row no-gutters class="align-center ga-1">
          <InPlayCardSlot
            v-for="i in 3"
            :key="i"
            :card="game?.Player1.Bench[i - 1]"
            :height-px="140"
          />
        </v-row>
      </div>
      <v-row no-gutters class="ga-2">
        <div v-for="(card, i) of game?.Player1.Hand" :key="i">
          <PlayingCard :card="card" />
        </div>
      </v-row>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import type { DeckInfo } from "@/types/Deck";
import PlayingCard from "./PlayingCard.vue";
import { GameState } from "@/models/GameState";
import { RandomAgent } from "@/models/agents/RandomAgent";
import { onMounted, ref } from "vue";
import InPlayCardSlot from "./InPlayCardSlot.vue";

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

onMounted(() => {
  player.value = new RandomAgent(prebuiltDecks.Celebi1);
  opponent.value = new RandomAgent(prebuiltDecks.Alakazam1);

  game.value = new GameState(
    {
      DeckSize: 20,
      HandSize: 5,
    },
    player.value,
    opponent.value
  );

  setTimeout(async () => {
    if (!game.value) return;

    game.value.start();
  }, 3000);
});
</script>
