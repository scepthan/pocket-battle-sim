<template>
  <v-app>
    <v-main>
      <PlayingField v-if="cardStore.Cards.length > 0" />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { usePlayingCardStore } from "./stores/usePlayingCardStore";
import PlayingField from "./components/PlayingField.vue";

const cardStore = usePlayingCardStore();

cardStore.loadCards();
</script>

<style scoped>
div.v-application {
  background-color: #c0d8ef;
}
</style>
