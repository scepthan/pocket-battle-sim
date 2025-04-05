<template>
  <v-container fluid>
    <div class="d-flex" style="width: 1004px; height: 704px">
      <div class="d-flex w-100 justify-center flex-row">
        <div class="d-flex flex-column align-center ga-2">
          <v-row no-gutters class="align-center ga-1">
            <InPlayCardSlot
              v-for="i in 3"
              :key="i"
              :card="game?.Player2.Bench[i - 1]"
              :height-px="140"
            />
          </v-row>
          <v-row no-gutters class="align-center">
            <InPlayCardSlot :card="game?.Player2.ActivePokemon" />
          </v-row>

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

        <div
          class="h-100 d-flex flex-column align-center justify-space-between"
        >
          <div class="d-flex flex-row">
            <div class="d-flex flex-column align-center" style="width: 128px">
              <span>{{ game?.Player2.Name }}</span>
              <EnergyZone
                class="ml-5"
                :current-energy="game?.Player2.AvailableEnergy"
                :next-energy="game?.Player2.NextEnergy"
              />
            </div>
            <PlayerHandHidden :cards="game?.Player2.Hand.length ?? 0" />
          </div>
          <div
            class="flex-grow-1 w-100 d-flex flex-column-reverse overflow-y-auto"
          >
            <GameLog
              :log-entries="game?.GameLog.entries ?? []"
              :shown-players="['Celebii']"
            />
          </div>
          <div class="d-flex flex-row align-end">
            <div class="d-flex flex-column align-center" style="width: 128px">
              <EnergyZone
                class="ml-5"
                :current-energy="game?.Player1.AvailableEnergy"
                :next-energy="game?.Player1.NextEnergy"
              />
              <span>{{ game?.Player1.Name }}</span>
            </div>
            <PlayerHandVisible :cards="game?.Player1.Hand ?? []" />
          </div>
        </div>
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import { GameState } from "@/models/GameState";
import { RandomAgent } from "@/models/agents/RandomAgent";
import type { DeckInfo } from "@/types";
import { onMounted, ref } from "vue";
import GameLog from "./GameLog.vue";
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
  player.value = new RandomAgent("Celebii", prebuiltDecks.Celebi1);
  opponent.value = new RandomAgent("AlexTheZam", prebuiltDecks.Alakazam1);

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
