<template>
  <v-container fluid>
    <div class="d-flex flex-wrap ga-2">
      <div v-for="(card, i) of deck.Cards" :key="i">
        <PokemonCard :card="card" />
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import type { DeckInfo } from "@/types/Deck";
import { ref } from "vue";
import PokemonCard from "./PokemonCard.vue";

const prebuiltDecks: Record<string, DeckInfo> = {
  Celebi1: {
    Cards: [
      "A1a-004",
      "A1a-004",
      "A1a-005",
      "A1a-005",
      "A1a-006",
      "A1a-006",
      "A1a-009",
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
      "A1-117",
      "A1-117",
      "A1-132",
      "A1a-033",
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

const deck = ref<DeckInfo>(prebuiltDecks.Celebi1);
</script>
