<template>
  <v-app>
    <v-main> Hello world! </v-main>
  </v-app>
</template>

<script setup lang="ts">
import card_data from "./assets/cards.json";
import type { InputCard } from "./types/InputCard.js";

const cards: InputCard[] = card_data;
console.log(cards);
</script>
