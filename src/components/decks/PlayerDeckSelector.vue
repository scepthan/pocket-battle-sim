<template>
  <DeckCard
    v-if="selectedDeck"
    :deck="selectedDeck"
    :deck-name="selectedDeckName!"
    no-dialog
    @click="dialog = true"
  />
  <EmptyDeckCard v-else class="d-flex justify-center align-center" @click="dialog = true">
    Random...?
  </EmptyDeckCard>

  <v-dialog v-model="dialog" width="850">
    <v-card class="pa-4" style="max-height: 600px">
      <v-card-text>
        <v-select v-model="selectedDecklist" :items="decklists" item-title="name" return-object />
        <div class="d-flex flex-wrap ga-4">
          <div v-for="(deck, name) in selectedDecklist.decks" :key="name">
            <DeckCard
              disable-if-invalid
              :deck="deck"
              :builtin-name="selectedDecklist.name"
              :deck-name="name"
              no-dialog
              @click="setDeck(deck, name)"
            />
          </div>
          <EmptyDeckCard v-if="Object.keys(selectedDecklist.decks).length === 0">
            Nothing here...
          </EmptyDeckCard>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-btn variant="elevated" color="blue" @click="setRandomDeck"> Random Deck </v-btn>
        <v-btn @click="dialog = false"> Close </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { DeckInfo } from "@/core";
import { useDeckStore } from "@/stores";

const selectedDeck = defineModel<DeckInfo | undefined>("deck");
const selectedDeckName = defineModel<string | undefined>("deckName");

const deckStore = useDeckStore();

const dialog = ref(false);

const decklists = computed(() => [
  { name: "Custom", decks: deckStore.CustomDecks },
  ...Object.entries(deckStore.BuiltinDecklists).map(([name, decks]) => ({ name, decks })),
]);
const selectedDecklist = ref(decklists.value[0]!);

const setDeck = (deck: DeckInfo, name: string) => {
  selectedDeck.value = deck;
  selectedDeckName.value = selectedDecklist.value.name + " - " + name;
  dialog.value = false;
};
const setRandomDeck = () => {
  selectedDeck.value = undefined;
  selectedDeckName.value = undefined;
  dialog.value = false;
};

onMounted(() => {
  if (selectedDeckName.value) {
    selectedDecklist.value = decklists.value.find((list) =>
      selectedDeckName.value!.startsWith(list.name + " - "),
    )!;
  }
});
</script>
