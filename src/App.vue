<template>
  <v-app>
    <v-main>
      Hello world!
      <PlayingField />
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
