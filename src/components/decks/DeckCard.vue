<template>
  <EmptyDeckCard
    :disabled="disableIfInvalid && deck.InvalidReasons && deck.InvalidReasons.length > 0"
    @click="true"
  >
    <div class="d-flex justify-center ga-2 pa-2">
      <div v-for="(card, i) in highlightCards" :key="i">
        <PlayingCardImage :card-id="card" height="100" />
      </div>
    </div>
    <div>
      <EnergyIcon v-for="(energy, i) in deck.EnergyTypes" :key="i" :energy="energy" inline />
    </div>
    <div class="deck-name">{{ displayName ?? deckName }}</div>

    <v-dialog v-if="!noDialog" v-model="dialog" activator="parent" width="850">
      <DeckDisplayDialog
        :deck="deck"
        :builtin-name="builtinName"
        :deck-name="deckName"
        @close="dialog = false"
      />
    </v-dialog>
  </EmptyDeckCard>
</template>

<script setup lang="ts">
import { sortedBy, type DeckInfo } from "@/core";
import { usePlayingCardStore } from "@/stores";

export interface Props {
  deck: DeckInfo;
  builtinName?: string;
  deckName: string;
  displayName?: string;
  noDialog?: boolean;
  disableIfInvalid?: boolean;
}
const props = defineProps<Props>();

const cardStore = usePlayingCardStore();

const findNamedCard = (deck: DeckInfo, name: string) =>
  cardStore.InputCards.find((card) => card.name === name && deck.Cards.includes(card.id))?.id ??
  "PROMO-A-007";

const highlightCards = computed(() => {
  if (props.deck.HighlightCards)
    return props.deck.HighlightCards.map((name) => findNamedCard(props.deck, name));

  const splitName = props.deckName
    .replace(" Drop Event", "")
    .split(" & ")
    .map((name) => findNamedCard(props.deck, name));
  if (splitName.every((cardId) => cardId !== "PROMO-A-007")) return splitName;

  const deckCards = props.deck.Cards.map((card) => cardStore.getCardById(card))
    .filter((card) => card?.CardType === "Pokemon")
    .filter((card, i, arr) => arr.findIndex((c2) => card.Name === c2.Name) === i)
    .filter((card, i, arr) => !arr.find((c2) => c2.EvolvesFrom === card.Name));
  return sortedBy(deckCards, (card) => -card.BaseHP)
    .slice(0, 2)
    .map((card) => card?.ID);
});

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
