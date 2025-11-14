<template>
  <v-container fluid class="pa-2" style="width: 1320px">
    <h1>Deck Builder</h1>
    <DeckBuilder
      :name="name"
      :initial-deck="deck"
      :editing-deck="editingDeck"
      @save="(name) => (editingDeck = name)"
    />
  </v-container>
</template>

<script setup lang="ts">
import type { DeckInfo } from "@/core";
import { useDeckStore } from "@/stores";

const route = useRoute();
const deckStore = useDeckStore();

const name = ref((route.query.name as string) ?? "");
const deck = ref<DeckInfo>({
  Cards: [],
  EnergyTypes: ["Grass"],
});
const editingDeck = ref<string>();

if (route.query.clone === "1") {
  if (route.query.builtinList) {
    const deckInfo = deckStore.BuiltinDecklists[route.query.builtinList as string]?.[name.value];
    if (!deckInfo)
      throw new Error(
        `Could not find builtin deck: ${route.query.builtinList} - ${route.query.name}`
      );
    deck.value = deckInfo;
  } else {
    const deckInfo = deckStore.CustomDecks[name.value];
    if (!deckInfo) throw new Error(`Could not find custom deck: ${route.query.name}`);
    deck.value = deckInfo;
  }
} else if (route.query.name) {
  const deckInfo = deckStore.CustomDecks[name.value];
  if (!deckInfo) throw new Error(`Could not find custom deck: ${route.query.name}`);
  deck.value = deckInfo;
  editingDeck.value = name.value;
}
</script>
