<template>
  <div class="d-flex ga-4">
    <v-text-field v-model="searchQuery" variant="outlined" label="Search terms" clearable />
    <SearchSort v-model="sortBy" />
    <FilterDialog v-model="searchFilters" @reset-filters="resetFilters" />
  </div>
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
import { useDisableArtFilter } from "@/composables";
import { sortedBy, type PlayingCard } from "@/core";
import { usePlayingCardStore } from "@/stores";
import type { SearchFilters } from "@/types";
import type { CardSorter } from "./SearchSort.vue";

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
const { disableArtFilter } = useDisableArtFilter();

const cardStore = usePlayingCardStore();
const cardsFiltered = computed(() =>
  sortedBy(
    cardStore.Cards.filter((card) => {
      if (searchQuery.value && !card.Name.toLowerCase().includes(searchQuery.value.toLowerCase()))
        return false;
      if (searchFilters.isPokemon !== null) {
        if (searchFilters.isPokemon !== (card.CardType === "Pokemon")) return false;
      }
      if (searchFilters.type.length > 0) {
        if (card.CardType !== "Pokemon" || !searchFilters.type.includes(card.Type)) return false;
      }
      if (searchFilters.stage.length > 0) {
        if (card.CardType !== "Pokemon" || !searchFilters.stage.includes(card.Stage)) return false;
      }
      if (searchFilters.isEx !== null) {
        if (card.CardType !== "Pokemon") return false;
        if (searchFilters.isEx !== card.Name.endsWith(" ex")) return false;
      }
      if (searchFilters.isMega !== null) {
        if (card.CardType !== "Pokemon") return false;
        if (searchFilters.isMega !== card.Name.startsWith("Mega ")) return false;
      }
      if (searchFilters.isUltraBeast !== null) {
        if (card.CardType !== "Pokemon") return false;
        if (searchFilters.isUltraBeast !== card.isUltraBeast) return false;
      }
      if (searchFilters.hasAbility !== null) {
        if (card.CardType !== "Pokemon") return false;
        if (searchFilters.hasAbility !== !!card.Ability) return false;
      }
      if (searchFilters.weakness.length > 0) {
        if (card.CardType !== "Pokemon") return false;
        if (card.Weakness === undefined) {
          if (!searchFilters.weakness.includes("Dragon")) return false;
        } else if (!searchFilters.weakness.includes(card.Weakness)) return false;
      }
      if (searchFilters.retreatCost.length > 0) {
        if (card.CardType !== "Pokemon") return false;
        if (!searchFilters.retreatCost.includes(card.RetreatCost)) return false;
      }
      if (searchFilters.hpMin) {
        if (card.CardType !== "Pokemon") return false;
        if (card.BaseHP < searchFilters.hpMin) return false;
      }
      if (searchFilters.hpMax) {
        if (card.CardType !== "Pokemon") return false;
        if (card.BaseHP > searchFilters.hpMax) return false;
      }
      if (searchFilters.trainerType.length > 0) {
        if (!searchFilters.trainerType.includes(card.CardType)) return false;
      }
      if (searchFilters.rarity.length > 0) {
        if (!searchFilters.rarity.includes(card.Rarity)) return false;
      } else if (disableArtFilter.value) {
        if (!["C", "U", "R", "RR"].includes(card.Rarity)) return false;
      }
      if (searchFilters.expansion.length > 0) {
        if (!searchFilters.expansion.some((set) => card.ID.startsWith(set + "-"))) return false;
      }
      return true;
    }),
    sortBy.value
  )
);
const cardRows = computed(() => {
  const rows = [];
  for (let i = 0; i < cardsFiltered.value.length; i += props.cardsPerRow) {
    rows.push(cardsFiltered.value.slice(i, i + props.cardsPerRow));
  }
  return rows;
});

const baseFilters: SearchFilters = {
  isPokemon: null,
  type: [],
  stage: [],
  isEx: null,
  isMega: null,
  isUltraBeast: null,
  hasAbility: null,
  weakness: [],
  retreatCost: [],
  hpMin: null,
  hpMax: null,
  trainerType: [],
  rarity: [],
  expansion: [],
  isPromo: null,
};

const searchFilters = reactive<SearchFilters>(Object.assign({}, baseFilters));
const sortBy = ref<CardSorter>((card) => card.ID);

const resetFilters = () => {
  Object.assign(searchFilters, baseFilters);
};
</script>
