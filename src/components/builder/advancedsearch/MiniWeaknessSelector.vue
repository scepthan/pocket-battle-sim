<template>
  <v-chip-group v-model="selectedTypes" multiple column>
    <v-chip
      v-for="type in filteredTypes"
      :key="type"
      :value="type"
      color="#f0f"
      class="d-flex justify-center"
    >
      <v-avatar v-if="type !== 'Dragon'" size="24">
        <EnergyIcon :energy="type" width="24px" />
      </v-avatar>
      <span v-else>None</span>
    </v-chip>
  </v-chip-group>
</template>

<script setup lang="ts">
import { allTypes, type Energy } from "@/core";

const selectedTypes = defineModel<Energy[]>();

const filteredTypes = computed(() => allTypes.filter((e) => e !== "Colorless"));
</script>
