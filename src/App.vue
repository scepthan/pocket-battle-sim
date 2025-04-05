<template>
  <v-app>
    <v-main>
      <PlayingField v-if="cardStore.Cards.length > 0" />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import PlayingField from "./components/PlayingField.vue";
import { usePlayingCardStore } from "./stores/usePlayingCardStore";

const cardStore = usePlayingCardStore();

void cardStore.loadCards();
</script>

<style scoped>
div.v-application {
  background-color: #c0d8ef;
}
</style>
