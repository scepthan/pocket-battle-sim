<template>
  <div class="card-container">
    <div v-for="(card, i) of cards" :key="i" class="hand-card-active">
      <PlayingCard :card="card" :height-px="200" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PlayingCard } from "@/core";

export interface Props {
  cards: PlayingCard[] | number;
}
defineProps<Props>();
</script>

<style scoped>
.card-container {
  width: 534px;
  height: 230px;
}
.hand-card-active {
  margin-top: 30px;
  margin-right: -100px;
  float: left;

  transition: margin-top 0.3s;
}
.hand-card-active:hover {
  margin-top: 0px;
}
.hand-card-active:last-child {
  margin-right: 0px !important;
}
</style>
