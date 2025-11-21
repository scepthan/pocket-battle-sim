<template>
  <PlayingCardCollection :count="cards.length">
    <template #card="{ index }">
      <PlayingCard :card="cards[index - 1]" :height-px="200" />
    </template>
  </PlayingCardCollection>
</template>

<script setup lang="ts">
import type { PlayingCard } from "@/core";

export interface Props {
  cards: PlayingCard[];
}
defineProps<Props>();
</script>

<style scoped>
:deep(.hand-card) {
  margin-top: 30px;
  transition: margin-top 0.3s;
}
:deep(.hand-card:hover) {
  margin-top: 0px;
}
</style>
