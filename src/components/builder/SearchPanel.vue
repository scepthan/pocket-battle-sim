<template>
  <div class="d-flex ga-4">
    <v-text-field v-model="currentSearchQuery" variant="outlined" label="Search terms" clearable />
    <SearchSort v-model="sortBy" />
    <FilterDialog v-model="searchFilters" @reset-filters="resetFilters" />
  </div>
  <v-virtual-scroll :height="600" :items="cardRows" class="pr-4 no-select">
    <template #default="{ item: row }">
      <v-row class="mb-2">
        <v-col v-for="card in row" :key="card.id" cols="4">
          <SelectableCard
            v-model:selected-cards="selectedCards"
            :card="card"
            :count="selectedCards.filter((x) => x.id == card.id).length"
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
const currentSearchQuery = ref("");
watch(currentSearchQuery, (newVal) =>
  setTimeout(() => {
    if (currentSearchQuery.value == newVal) {
      searchQuery.value = newVal;
    }
  }, 300),
);
const { disableArtFilter } = useDisableArtFilter();
const cardStore = usePlayingCardStore();

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
  isFullyImplemented: null,
};

const searchFilters = reactive<SearchFilters>(Object.assign({}, baseFilters));
const sortBy = ref<CardSorter>((card) => card.id);

const resetFilters = () => {
  Object.assign(searchFilters, baseFilters);
};

const toNormalLower = (str: string) =>
  str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const cardFilter = (card: PlayingCard) => {
  if (searchFilters.isFullyImplemented !== null) {
    if (searchFilters.isFullyImplemented !== card.parseSuccessful) return false;
  }
  if (searchFilters.isPokemon !== null) {
    if (searchFilters.isPokemon !== (card.cardType === "Pokemon")) return false;
  }
  if (searchFilters.type.length > 0) {
    if (card.cardType !== "Pokemon" || !searchFilters.type.includes(card.type)) return false;
  }
  if (searchFilters.stage.length > 0) {
    if (card.cardType !== "Pokemon" || !searchFilters.stage.includes(card.stage)) return false;
  }
  if (searchFilters.isEx !== null) {
    if (card.cardType !== "Pokemon") return false;
    if (searchFilters.isEx !== card.name.endsWith(" ex")) return false;
  }
  if (searchFilters.isMega !== null) {
    if (card.cardType !== "Pokemon") return false;
    if (searchFilters.isMega !== card.name.startsWith("Mega ")) return false;
  }
  if (searchFilters.isUltraBeast !== null) {
    if (card.cardType !== "Pokemon") return false;
    if (searchFilters.isUltraBeast !== card.isUltraBeast) return false;
  }
  if (searchFilters.hasAbility !== null) {
    if (card.cardType !== "Pokemon") return false;
    if (searchFilters.hasAbility !== !!card.ability) return false;
  }
  if (searchFilters.weakness.length > 0) {
    if (card.cardType !== "Pokemon") return false;
    if (card.weakness === undefined) {
      if (!searchFilters.weakness.includes(null)) return false;
    } else if (!searchFilters.weakness.includes(card.weakness)) return false;
  }
  if (searchFilters.retreatCost.length > 0) {
    if (card.cardType !== "Pokemon") return false;
    if (!searchFilters.retreatCost.includes(card.retreatCost)) return false;
  }
  if (searchFilters.hpMin) {
    if (card.cardType !== "Pokemon") return false;
    if (card.baseHP < searchFilters.hpMin) return false;
  }
  if (searchFilters.hpMax) {
    if (card.cardType !== "Pokemon") return false;
    if (card.baseHP > searchFilters.hpMax) return false;
  }
  if (searchFilters.trainerType.length > 0) {
    if (!searchFilters.trainerType.includes(card.cardType)) return false;
  }
  if (searchFilters.rarity.length > 0) {
    if (!searchFilters.rarity.includes(card.rarity)) return false;
  } else if (disableArtFilter.value) {
    if (!["C", "U", "R", "RR"].includes(card.rarity)) return false;
  }
  if (searchFilters.expansion.length > 0) {
    if (!searchFilters.expansion.some((set) => card.id.startsWith(set + "-"))) return false;
  }

  if (searchQuery.value) {
    const queriable = [card.name];
    if (card.cardType === "Pokemon") {
      if (card.ability) {
        queriable.push(card.ability.name, card.ability.text);
      }
      for (const attack of card.attacks) {
        queriable.push(attack.name, attack.text ?? "");
      }
    } else {
      queriable.push(card.text);
    }
    if (!queriable.some((t) => toNormalLower(t).includes(toNormalLower(searchQuery.value))))
      return false;
  }

  return true;
};

const cardsFiltered = computed(() => sortedBy(cardStore.Cards.filter(cardFilter), sortBy.value));
const cardRows = computed(() => {
  const rows = [];
  for (let i = 0; i < cardsFiltered.value.length; i += props.cardsPerRow) {
    rows.push(cardsFiltered.value.slice(i, i + props.cardsPerRow));
  }
  return rows;
});
</script>
