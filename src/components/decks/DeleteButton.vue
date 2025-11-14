<template>
  <v-dialog v-model="dialogOpen" max-width="400px">
    <template #activator="{ props }">
      <TooltipButton
        v-bind="props"
        tooltip="Delete"
        icon="mdi-delete"
        variant="elevated"
        color="red"
      />
    </template>
    <v-card>
      <v-card-title>Delete Custom Deck?</v-card-title>
      <v-card-text>This will permanently remove "{{ name }}" from your storage.</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="elevated" color="error" @click="deleteCustomDeck(name)">Yes, delete</v-btn>
        <v-btn @click="dialogOpen = false">Cancel</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useDeckStore } from "@/stores";

export interface Props {
  name: string;
}
defineProps<Props>();

const { deleteCustomDeck } = useDeckStore();

const dialogOpen = ref(false);
</script>
