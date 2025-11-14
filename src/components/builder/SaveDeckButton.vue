<template>
  <TooltipButton tooltip="Save" icon="mdi-content-save" size="small" @click="onClick" />

  <v-dialog v-model="dialogOpen" max-width="400px">
    <v-card>
      <v-card-title>Overwrite Custom Deck?</v-card-title>
      <v-card-text>
        There is already a custom deck named "{{ name }}" in your storage. Saving this deck will
        overwrite it.
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="elevated" color="error" @click="saveDeck">Yes, overwrite</v-btn>
        <v-btn @click="dialogOpen = false">Cancel</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-snackbar v-model="snackbar" timeout="2000" location="top">
    Saved deck to browser storage!
    <template #actions>
      <v-btn icon="mdi-close" @click="snackbar = false" />
    </template>
  </v-snackbar>
</template>

<script setup lang="ts">
import type { DeckInfo } from "@/core";
import { useDeckStore } from "@/stores";

export interface Props {
  name: string;
  deck: DeckInfo;
  editingDeck?: string;
}
const props = defineProps<Props>();

export interface Emits {
  (e: "save"): void;
}
const emit = defineEmits<Emits>();

const snackbar = ref(false);
const dialogOpen = ref(false);

const deckStore = useDeckStore();

const onClick = () => {
  if (props.name in deckStore.CustomDecks && props.name !== props.editingDeck) {
    dialogOpen.value = true;
  } else {
    saveDeck();
  }
};
const saveDeck = () => {
  deckStore.saveCustomDeck(props.name, props.deck);
  snackbar.value = true;
  dialogOpen.value = false;
  emit("save");
};
</script>
