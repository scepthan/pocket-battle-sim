<template>
  <div v-if="game && game.isSelfTurn">
    <p>What would you like to do?</p>

    <div class="d-flex flex-wrap ga-2">
      <v-btn>Play Card</v-btn>
      <v-btn>Attach Energy</v-btn>
      <v-btn>Use Ability</v-btn>
      <v-btn>Attack</v-btn>
      <v-btn>Retreat</v-btn>
      <v-btn :color="playableCards.length > 0 ? 'red' : 'default'">End Turn</v-btn>
    </div>
  </div>
  <div v-else>
    <p>Waiting for opponent...</p>
  </div>
</template>

<script setup lang="ts">
import type { PlayerGameView } from "@/core";

export interface Props {
  game?: PlayerGameView;
}
const props = defineProps<Props>();

const playableCards = computed(
  () => props.game?.selfHand.filter((card) => props.game?.canPlayCard(card)) ?? []
);
</script>
