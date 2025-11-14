<template>
  <v-container fluid class="pa-2" style="max-width: 1320px">
    <h1>Decks</h1>

    <h2>Custom</h2>
    <v-row>
      <v-col v-for="(deck, name) in deckStore.CustomDecks">
        <DeckCard :deck="deck" :name="name" />
      </v-col>

      <v-col v-if="Object.keys(deckStore.CustomDecks).length === 0">None</v-col>
    </v-row>

    <h2>Builtin</h2>
    <v-select v-model="selectedDecklist" :items="decklists" item-title="name" item-value="deck" />
    <div class="d-flex flex-wrap ga-4">
      <div v-for="(deck, name) in selectedDecklist">
        <DeckCard :deck="deck" :name="name" />
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import type { DeckList } from "@/assets";
import { useDeckStore } from "@/stores";

const deckStore = useDeckStore();
const decklists = computed(() =>
  Object.entries(deckStore.BuiltinDecklists).map(([name, deck]) => ({ name, deck }))
);

const selectedDecklist = ref<DeckList>(decklists.value[0]!.deck);
</script>
