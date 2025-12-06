<template>
  <v-tooltip text="Can't save deck without a name!" location="top" :disabled="!!deckName">
    <template #activator="{ props }">
      <div v-bind="props" class="d-inline-block">
        <TooltipButton
          :tooltip="tooltip"
          :disabled="!deckName"
          :color="color"
          icon="mdi-content-save"
          size="small"
          @click="onClick"
        />
      </div>
    </template>
  </v-tooltip>

  <v-dialog v-model="dialogOpen" max-width="400px">
    <v-card>
      <v-card-title>Overwrite Custom Deck?</v-card-title>
      <v-card-text>
        There is already a custom deck named "{{ deckName }}" in your storage. Saving this deck will
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
import { parseDeck, useDeckValidator, type Deck, type DeckInfo } from "@/core";
import { useDeckStore } from "@/stores";

export interface Props {
  deckName: string;
  deck: DeckInfo;
  editingDeck?: string;
}
const passedProps = defineProps<Props>();

export interface Emits {
  (e: "save"): void;
}
const emit = defineEmits<Emits>();

const snackbar = ref(false);
const dialogOpen = ref(false);

const deckStore = useDeckStore();

const deckValidator = useDeckValidator({
  DeckSize: 20,
  DelayPerAction: 0,
  InitialHandSize: 0,
  MaxHandSize: 0,
  PrizePoints: 0,
  TurnLimit: 0,
});

const fullDeck = computed<Deck>(() => ({
  Cards: parseDeck(passedProps.deck.Cards),
  EnergyTypes: passedProps.deck.EnergyTypes,
}));
const validation = computed(() => deckValidator.validateDeck(fullDeck.value));
const tooltip = computed(() =>
  validation.value !== true
    ? "Deck can be saved but not used:\n\n" + validation.value.join("; ")
    : "Save"
);
const color = computed(() =>
  passedProps.deckName && validation.value !== true ? "warning" : "default"
);

const onClick = () => {
  if (
    passedProps.deckName in deckStore.CustomDecks &&
    passedProps.deckName !== passedProps.editingDeck
  ) {
    dialogOpen.value = true;
  } else {
    saveDeck();
  }
};
const saveDeck = () => {
  deckStore.saveCustomDeck(passedProps.deckName, passedProps.deck);
  if (passedProps.editingDeck && passedProps.editingDeck !== passedProps.deckName) {
    deckStore.deleteCustomDeck(passedProps.editingDeck);
  }
  snackbar.value = true;
  dialogOpen.value = false;
  emit("save");
};
</script>
