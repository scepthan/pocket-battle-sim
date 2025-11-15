<template>
  <v-chip-group v-model="selectedTypes" multiple column>
    <v-chip v-for="(text, i) in allStages" :key="i" :value="i" color="#d0d">
      {{ text }}
    </v-chip>
  </v-chip-group>
</template>

<script setup lang="ts">
const selectedTypes = defineModel<number[]>();

const allStages = ["Basic", "Stage 1", "Stage 2"];
</script>
