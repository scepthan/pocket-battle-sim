<template>
  <v-app>
    <v-main>
      <RouterView />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { usePlayingCardStore } from "./stores/usePlayingCardStore";

const cardStore = usePlayingCardStore();

void cardStore.loadCards();
</script>

<style scoped>
div.v-application {
  background-color: #c0d8ef;
}
</style>
