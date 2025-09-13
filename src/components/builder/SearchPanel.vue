<template>
  <v-text-field v-model="searchQuery" variant="outlined" label="Search terms" clearable />
  <v-virtual-scroll :height="600" :items="cardRows" class="pr-4 no-select">
    <template #default="{ item: row }">
      <v-row class="mb-2">
        <v-col v-for="(card, index) in row" :key="index" cols="4">
          <SelectableCard
            v-model:selected-cards="selectedCards"
            :card="card"
            :count="selectedCards.filter((x) => x.ID == card.ID).length"
            :height-px="160"
            @click="emits('card-clicked', card)"
            @contextmenu.prevent="emits('card-unclicked', card)"
          />
        </v-col>
      </v-row>
    </template>
  </v-virtual-scroll>
</template>

<script setup lang="ts">
import { type PlayingCard } from "@/core";
import { usePlayingCardStore } from "@/stores";
import { computed, ref } from "vue";

export interface Props {
  cardsPerRow?: number;
}

const props = withDefaults(defineProps<Props>(), { cardsPerRow: 3 });
const selectedCards = defineModel<PlayingCard[]>("selected-cards", { required: true });

const emits = defineEmits<{
  (e: "card-clicked", card: PlayingCard): void;
  (e: "card-unclicked", card: PlayingCard): void;
}>();

const searchQuery = ref("");

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
const cardRows = computed(() => {
  const rows = [];
  for (let i = 0; i < cardsFiltered.value.length; i += props.cardsPerRow) {
    rows.push(cardsFiltered.value.slice(i, i + props.cardsPerRow));
  }
  return rows;
});
</script>
