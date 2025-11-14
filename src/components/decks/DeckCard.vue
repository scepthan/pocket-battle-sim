<template>
  <EmptyDeckCard @click="true">
    <div class="d-flex justify-center ga-2 pa-2">
      <div v-for="(card, i) in deck.HighlightCards ?? findHighlightCards(name)" :key="i">
        <PlayingCardImage :card-id="findNamedCard(deck, card)" height="100" />
      </div>
    </div>
    <div>
      <EnergyIcon v-for="(energy, i) in deck.EnergyTypes" :key="i" :energy="energy" inline />
    </div>
    <div class="deck-name">{{ name }}</div>

    <v-dialog v-model="dialog" activator="parent" width="850">
      <DeckDisplayDialog
        :deck="deck"
        :builtin-list="builtinList"
        :name="name"
        @close="dialog = false"
      />
    </v-dialog>
  </EmptyDeckCard>
</template>

<script setup lang="ts">
import type { DeckInfo } from "@/core";
import { usePlayingCardStore } from "@/stores";

export interface Props {
  deck: DeckInfo;
  builtinList?: string;
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
.energy-icon {
  height: 24px;
  margin: -4px 2px;
}
</style>
