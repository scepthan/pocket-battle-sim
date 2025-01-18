<template>
  <v-app>
    <v-main> Hello world! </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { usePlayingCardStore } from "./stores/usePlayingCardStore";

const cardStore = usePlayingCardStore();

cardStore.loadCards();
</script>
