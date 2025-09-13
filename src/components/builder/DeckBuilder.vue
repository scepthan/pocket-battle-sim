<template>
  <v-row>
    <v-col cols="8">
      <v-row class="align-center">
        <v-col cols="4">
          <v-text-field
            v-model="deckName"
            variant="outlined"
            density="comfortable"
            hide-details
            label="Deck Name"
          />
        </v-col>
        <v-col cols="8" class="d-flex ga-2 align-center">
          <EnergySelector v-model="energyTypes" />
          <ResetDeckButton @reset="resetDeck" />
          <CopyJsonButton
            :deck="{ Cards: selectedCards.map((x) => x.ID), EnergyTypes: energyTypes }"
          />
        </v-col>
      </v-row>

      <div>Cards: {{ selectedCards.length }}</div>

      <DeckDisplay v-model:selected-cards="selectedCards" />
    </v-col>
    <v-col cols="4" class="pl-6">
      <SearchPanel v-model:selected-cards="selectedCards" :cards-per-row="3" />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { type Energy, type PlayingCard } from "@/core";
import { ref } from "vue";
import CopyJsonButton from "./CopyJsonButton.vue";
import DeckDisplay from "./DeckDisplay.vue";
import EnergySelector from "./EnergySelector.vue";
import ResetDeckButton from "./ResetDeckButton.vue";
import SearchPanel from "./SearchPanel.vue";

const selectedCards = ref<PlayingCard[]>([]);
const deckName = ref("");
const energyTypes = ref<Energy[]>(["Grass"]);

const resetDeck = () => {
  selectedCards.value = [];
  deckName.value = "";
  energyTypes.value = ["Grass"];
};
</script>

<style scoped>
.no-select {
  user-select: none;
}
</style>
