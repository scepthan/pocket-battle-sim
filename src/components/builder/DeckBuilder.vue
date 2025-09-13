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

      <v-row class="mb-2">
        <v-col
          v-for="(card, index) in selectedCards.filter((x, i, a) => a.indexOf(x) == i)"
          :key="index"
          cols="2"
        >
          <SelectableCard
            :card="card"
            :count="selectedCards.filter((x) => x.ID == card.ID).length"
            @click="() => cardClicked(card)"
            @contextmenu.prevent="() => cardUnclicked(card)"
          />
        </v-col>
      </v-row>
    </v-col>
    <v-col cols="4" class="pl-6">
      <v-text-field v-model="searchQuery" variant="outlined" label="Search terms" clearable />
      <v-virtual-scroll :height="600" :items="cardRows" class="pr-4 no-select">
        <template #default="{ item: row }">
          <v-row class="mb-2">
            <v-col v-for="(card, index) in row" :key="index" cols="4">
              <SelectableCard
                :card="card"
                :count="selectedCards.filter((x) => x.ID == card.ID).length"
                :height-px="160"
                @click="() => cardClicked(card)"
                @contextmenu.prevent="() => cardUnclicked(card)"
              />
            </v-col>
          </v-row>
        </template>
      </v-virtual-scroll>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { type Energy, type PlayingCard } from "@/core";
import { usePlayingCardStore } from "@/stores/usePlayingCardStore";
import { computed, ref } from "vue";
import CopyJsonButton from "./CopyJsonButton.vue";
import EnergySelector from "./EnergySelector.vue";
import ResetDeckButton from "./ResetDeckButton.vue";
import SelectableCard from "./SelectableCard.vue";

const cardStore = usePlayingCardStore();
const cardsFiltered = computed(() =>
  cardStore.Cards.filter(
    (card) =>
      searchQuery.value === "" ||
      searchQuery.value
        .toLowerCase()
        .split(" ")
        .every((term) => JSON.stringify(card).toLowerCase().includes(term))
  )
);

const cardsPerRow = 3;
const cardRows = computed(() => {
  const rows = [];
  for (let i = 0; i < cardsFiltered.value.length; i += cardsPerRow) {
    rows.push(cardsFiltered.value.slice(i, i + cardsPerRow));
  }
  return rows;
});

const searchQuery = ref("");

const selectedCards = ref<PlayingCard[]>([]);
const deckName = ref("");
const energyTypes = ref<Energy[]>(["Grass"]);

const cardClicked = (card: PlayingCard) => {
  if (selectedCards.value.filter((x) => x.Name == card.Name).length < 2) {
    selectedCards.value.push(card);
  }
};
const cardUnclicked = (card: PlayingCard) => {
  if (selectedCards.value.includes(card)) {
    selectedCards.value.splice(selectedCards.value.lastIndexOf(card), 1);
  }
};

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
