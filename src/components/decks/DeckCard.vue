<template>
  <v-card class="pa-2 text-center" width="180" height="216" @click="true">
    <div class="d-flex justify-center ga-2 pa-2">
      <div v-for="(card, i) in deck.HighlightCards ?? findHighlightCards(name)" :key="i">
        <PlayingCardImage :card-id="findNamedCard(deck, card)" height="100" />
      </div>
    </div>
    <div>
      <EnergyIcon
        v-for="(energy, i) in deck.EnergyTypes"
        :key="i"
        :energy="energy"
        height="24"
        inline
      />
    </div>
    <div class="deck-name">{{ name }}</div>

    <v-dialog v-model="dialog" activator="parent" width="850">
      <DeckDisplayDialog :deck="deck" :name="name" @close="dialog = false" />
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import type { DeckInfo } from "@/core";
import { usePlayingCardStore } from "@/stores";

export interface Props {
  deck: DeckInfo;
  name: string;
}
defineProps<Props>();

const cardStore = usePlayingCardStore();

const findHighlightCards = (deckName: string) => deckName.replace(" Drop Event", "").split(" & ");
const findNamedCard = (deck: DeckInfo, name: string) =>
  cardStore.InputCards.find((card) => card.name === name && deck.Cards.includes(card.id))?.id ??
  "PROMO-A-007";

const dialog = ref(false);
</script>

<style lang="css" scoped>
.deck-name {
  height: 3em;
  align-content: center;
}
</style>
