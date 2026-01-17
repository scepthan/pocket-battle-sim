<template>
  <v-card>
    <v-toolbar>
      <v-toolbar-title>
        {{ deckName }}
        <EnergyIcon v-for="(energy, i) in deck.EnergyTypes" :key="i" :energy="energy" inline />
      </v-toolbar-title>
      <v-toolbar-items>
        <v-btn icon="mdi-close" @click="emit('close')"></v-btn>
      </v-toolbar-items>
    </v-toolbar>

    <v-card-text>
      <div class="d-flex flex-wrap" style="gap: 8px">
        <PlayingCard v-for="(card, index) in cards" :key="index" :card="card" :height-px="150" />
      </div>
    </v-card-text>

    <v-card-actions>
      <EditButton v-if="!builtinName" :deck-name="deckName" />
      <CloneButton :deck-name="deckName" :builtin-list="builtinName" />
      <DeleteButton v-if="!builtinName" :deck-name="deckName" />
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { EnergyMap, sortedBy, type DeckInfo } from "@/core";
import { usePlayingCardStore } from "@/stores";

export interface Props {
  deck: DeckInfo;
  builtinName?: string;
  deckName: string;
}
const props = defineProps<Props>();

export interface Emits {
  (e: "close"): void;
}
const emit = defineEmits<Emits>();

const cardStore = usePlayingCardStore();

const cards = computed(() => {
  let output = props.deck.Cards.map((id) => cardStore.getCardById(id)).filter(
    (x) => x !== undefined,
  );
  output = sortedBy(output, (card) => (card.CardType === "Pokemon" ? card.Type : card.CardType), [
    ...Object.values(EnergyMap),
    "Fossil",
    "PokemonTool",
    "Item",
    "Supporter",
  ]);
  return output;
});
</script>

<style lang="css" scoped>
.energy-icon {
  height: 28px;
  margin-bottom: -6px;
  margin-left: 4px;
}
</style>
