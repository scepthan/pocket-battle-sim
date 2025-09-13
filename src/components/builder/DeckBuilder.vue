<template>
  <v-row>
    <v-col cols="9">
      <v-text-field v-model="searchQuery" label="Search terms" clearable />
      <v-virtual-scroll :height="600" :items="cardRows" class="pr-6 no-select">
        <template #default="{ item: row }">
          <v-row class="mb-2">
            <v-col v-for="(card, index) in row" :key="index" cols="2">
              <SelectableCard
                :card="card"
                :count="selectedCards.filter((x) => x.ID == card.ID).length"
                @click="() => cardClicked(card)"
                @contextmenu.prevent="() => cardUnclicked(card)"
              />
            </v-col>
          </v-row>
        </template>
      </v-virtual-scroll>
    </v-col>
    <v-col cols="3">
      <div class="json-output">Cards: {{ selectedCards.length }}<br />{{ deckJson }}</div>

      <v-row class="mb-2">
        <v-col
          v-for="(card, index) in selectedCards.filter((x, i, a) => a.indexOf(x) == i)"
          :key="index"
          cols="4"
        >
          <SelectableCard
            :card="card"
            :count="selectedCards.filter((x) => x.ID == card.ID).length"
            :height-px="150"
            @click="() => cardClicked(card)"
            @contextmenu.prevent="() => cardUnclicked(card)"
          />
        </v-col>
      </v-row>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import type { PlayingCard } from "@/core";
import { usePlayingCardStore } from "@/stores/usePlayingCardStore";
import { computed, ref } from "vue";
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

const cardsPerRow = 6;
const cardRows = computed(() => {
  const rows = [];
  for (let i = 0; i < cardsFiltered.value.length; i += cardsPerRow) {
    rows.push(cardsFiltered.value.slice(i, i + cardsPerRow));
  }
  return rows;
});

const searchQuery = ref("");

const selectedCards = ref<PlayingCard[]>([]);
const deckJson = computed(
  () =>
    `[${selectedCards.value
      .map((card) => `"${card.ID}"`)
      .sort()
      .join(", ")}]`
);
const cardClicked = (card: PlayingCard) => {
  if (selectedCards.value.filter((x) => x.Name == card.Name).length < 2) {
    selectedCards.value.push(card);
  }
};
const cardUnclicked = (card: PlayingCard) => {
  if (selectedCards.value.includes(card)) {
    selectedCards.value.splice(
      selectedCards.value.findIndex((x) => x === card),
      1
    );
  }
};
</script>

<style scoped>
.no-select {
  user-select: none;
}

.json-output {
  font-family: monospace;
}
</style>
