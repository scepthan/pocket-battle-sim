<template>
  <v-row class="mb-2">
    <v-col
      v-for="(card, index) in selectedCards.filter((x, i, a) => a.indexOf(x) == i)"
      :key="index"
      cols="2"
    >
      <SelectableCard
        v-model:selected-cards="selectedCards"
        :card="card"
        :count="selectedCards.filter((x) => x.ID == card.ID).length"
      />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import type { PlayingCard } from "@/core";
import SelectableCard from "./SelectableCard.vue";

defineModel<PlayingCard[]>("selected-cards", { required: true });
</script>
