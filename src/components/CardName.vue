<template>
  <v-tooltip :text="cardId" location="top" :offset="5">
    <template #activator="{ props }">
      <span v-bind="props" class="card-name">{{ cardName }}</span>
    </template>
  </v-tooltip>
</template>

<script setup lang="ts">
import { usePlayingCardStore } from "@/stores/usePlayingCardStore";
import { computed } from "vue";

export interface Props {
  cardId: string;
}
const { cardId } = defineProps<Props>();

const cardStore = usePlayingCardStore(); // Assuming you have a card store to get card details

const cardName = computed(() => cardStore.getCardById(cardId)?.Name || null);
</script>

<style scoped>
.card-name {
  border-bottom: 1px dotted #000;
}
</style>
