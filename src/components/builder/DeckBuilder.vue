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
          <EnergySelector
            v-model="energyTypes"
            :set-manually="customEnergySelected"
            @reset="resetEnergy"
          />
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
import { EnergyMap, sortedBy, type DeckInfo, type Energy, type PlayingCard } from "@/core";
import { useDeckStore, usePlayingCardStore } from "@/stores";

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
const deckStore = useDeckStore();

const selectedCards = ref<PlayingCard[]>(
  props.initialDeck.Cards.map((id) => cardStore.getCardById(id)).filter((x) => x !== undefined)
);
const deckName = ref(props.name);
if (deckName.value === "") {
  let newDeckNumber = 1;
  while (Object.keys(deckStore.CustomDecks).includes(`New Deck ${newDeckNumber}`)) {
    newDeckNumber++;
  }
  deckName.value = `New Deck ${newDeckNumber}`;
}
const energyTypes = ref<Energy[]>(props.initialDeck.EnergyTypes.slice());
const customEnergySelected = ref<boolean>(props.initialDeck.Cards.length > 0);
const computedEnergy = computed<Set<Energy>>(() => {
  const requiredEnergyTypes = new Set<Energy>();
  selectedCards.value.forEach((card) => {
    if (card.CardType !== "Pokemon") return;
    card.Attacks.forEach((attack) =>
      attack.requiredEnergy.forEach((energy) => {
        if (energy !== "Colorless" && requiredEnergyTypes.size < 3) requiredEnergyTypes.add(energy);
      })
    );
  });
  requiredEnergyTypes.delete("Colorless");
  if (requiredEnergyTypes.size === 0) {
    return new Set(["Grass"]);
  }
  return requiredEnergyTypes;
});
// Update energy types when selected cards change, unless user has set custom energy
watch(
  computedEnergy,
  (newVal) => {
    if (!customEnergySelected.value) {
      energyTypes.value = Array.from(newVal);
    }
  },
  { immediate: true }
);
// Mark as custom if selected energy types differ from computed energy
watch(energyTypes, () => {
  if (energyTypes.value.toString() !== Array.from(computedEnergy.value).toString()) {
    customEnergySelected.value = true;
  }
});
const resetEnergy = async () => {
  energyTypes.value = Array.from(computedEnergy.value);
  customEnergySelected.value = false;
};

const deck = computed<DeckInfo>(() => ({
  Cards: selectedCards.value.map((card) => card.ID),
  EnergyTypes: sortedBy(energyTypes.value, (x) => x, Object.values(EnergyMap)),
}));

const resetDeck = () => {
  selectedCards.value = [];
  deckName.value = "";
  energyTypes.value = ["Grass"];
  customEnergySelected.value = false;
};
</script>

<style scoped>
.no-select {
  user-select: none;
}
</style>
