<template>
  <v-tooltip :text="cardId + ': ' + cardType" location="top" :offset="5">
    <template #activator="{ props }">
      <span v-bind="props" class="card-name">{{ cardName }}</span>
    </template>
  </v-tooltip>
</template>

<script setup lang="ts">
import { usePlayingCardStore } from "@/stores";

export interface Props {
  cardId: string;
}
const { cardId } = defineProps<Props>();

const cardStore = usePlayingCardStore();
const card = computed(() => cardStore.getCardById(cardId));
const cardName = computed(() => card.value?.Name || null);
const cardType = computed(() => card.value?.CardType || null);
</script>

<style scoped>
.card-name {
  border-bottom: 1px dotted #000;
}
</style>
