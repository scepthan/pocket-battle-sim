<template>
  <v-container fluid class="pa-2" style="max-width: 1320px">
    <h2>Custom Decks</h2>
    <div class="d-flex flex-wrap ga-4 mb-4">
      <div>
        <CreateDeckCard />
      </div>
      <div v-for="(deck, name) in deckStore.CustomDecks" :key="name">
        <DeckCard :deck="deck" :name="name" />
      </div>
    </div>

    <h2>Builtin Decks</h2>
    <v-select v-model="selectedDecklist" :items="decklists" item-title="name" return-object />
    <div class="d-flex flex-wrap ga-4">
      <div v-for="(deck, name) in selectedDecklist.decks" :key="name">
        <DeckCard :deck="deck" :builtin-list="selectedDecklist.name" :name="name" />
      </div>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import type { DeckList } from "@/assets";
import { useDeckStore } from "@/stores";

const deckStore = useDeckStore();
const decklists = computed(() =>
  Object.entries(deckStore.BuiltinDecklists).map(([name, decks]) => ({ name, decks }))
);

const selectedDecklist = ref<{ name: string; decks: DeckList }>(decklists.value[0]!);
</script>
