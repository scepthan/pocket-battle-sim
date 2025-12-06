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
          <SaveDeckButton
            :deck-name="deckName"
            :deck="deck"
            :editing-deck="editingDeck"
            @save="emit('save', deckName)"
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
import { type DeckInfo, type Energy, type PlayingCard } from "@/core";
import { usePlayingCardStore } from "@/stores";

export interface Props {
  name: string;
  initialDeck: DeckInfo;
  editingDeck?: string;
}
const props = defineProps<Props>();

export interface Emits {
  (e: "save", name: string): void;
}
const emit = defineEmits<Emits>();

const cardStore = usePlayingCardStore();

const selectedCards = ref<PlayingCard[]>(
  props.initialDeck.Cards.map((id) => cardStore.getCardById(id)).filter((x) => x !== undefined)
);
const deckName = ref(props.name);
const energyTypes = ref<Energy[]>(props.initialDeck.EnergyTypes.slice());

const deck = computed<DeckInfo>(() => ({
  Cards: selectedCards.value.map((card) => card.ID),
  EnergyTypes: energyTypes.value.slice(),
}));

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
