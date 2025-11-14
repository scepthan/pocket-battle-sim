<template>
  <v-dialog v-model="resetDialogOpen" max-width="400px">
    <template #activator="{ props }">
      <TooltipButton v-bind="props" tooltip="Delete All" icon="mdi-trash-can" size="small" />
    </template>
    <v-card>
      <v-card-title>Reset Deck?</v-card-title>
      <v-card-text>
        This will clear all selected cards, energy types, and the deck name.
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="elevated" color="error" @click="resetDeck()">Yes, reset</v-btn>
        <v-btn @click="resetDialogOpen = false">Cancel</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
const emits = defineEmits<{
  (e: "reset"): void;
}>();

const resetDialogOpen = ref(false);

const resetDeck = () => {
  resetDialogOpen.value = false;
  emits("reset");
};
</script>
