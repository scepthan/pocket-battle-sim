<template>
  <TooltipButton
    tooltip="Copy JSON"
    icon="mdi-clipboard-text-outline"
    size="small"
    @click="copyJson()"
  />

  <v-snackbar v-model="snackbar" timeout="2000" location="top">
    Copied deck JSON to clipboard!
    <template #actions>
      <v-btn icon="mdi-close" @click="snackbar = false" />
    </template>
  </v-snackbar>
</template>

<script setup lang="ts">
import type { DeckInfo } from "@/core";

const props = defineProps<{
  deck: DeckInfo;
}>();

const snackbar = ref(false);

const copyJson = async () => {
  const deckJson = `{
  "Cards": [${props.deck.Cards.map((card) => `"${card}"`)
    .sort()
    .join(", ")}],
  "EnergyTypes": [${props.deck.EnergyTypes.map((e) => `"${e}"`).join(", ")}]
}`;
  await navigator.clipboard.writeText(deckJson);
  snackbar.value = true;
};
</script>
