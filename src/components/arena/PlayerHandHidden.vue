<template>
  <PlayingCardCollection :count="cards">
    <v-tooltip activator="parent" location="bottom" :text="String(cards)" />
    <template #card>
      <PlayingCard :height-px="200" />
    </template>
  </PlayingCardCollection>
</template>

<script setup lang="ts">
export interface Props {
  cards: number;
}
defineProps<Props>();
</script>
