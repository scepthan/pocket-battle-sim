<template>
  <v-chip-group v-model="selectedTypes" multiple column>
    <v-chip v-for="(entry, i) in entries" :key="i" :value="entry.value" color="#f0f">
      {{ entry.name }}
    </v-chip>
  </v-chip-group>
</template>

<script setup lang="ts">
const selectedTypes = defineModel<string[]>();

const entries = [
  { name: "Item", value: "Item" },
  { name: "Item (Fossil)", value: "Fossil" },
  { name: "Tool", value: "PokemonTool" },
  { name: "Supporter", value: "Supporter" },
];
</script>
