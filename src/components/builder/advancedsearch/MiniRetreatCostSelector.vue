<template>
  <v-chip-group v-model="selectedCosts" multiple column>
    <v-chip v-for="i in 5" :key="i" :value="i - 1" color="#d0d">
      <EnergyIcon v-for="j in i - 1" :key="j" energy="Colorless" height="20" />
      <span v-if="i === 1">None</span>
    </v-chip>
  </v-chip-group>
</template>

<script setup lang="ts">
import EnergyIcon from "@/components/common/EnergyIcon.vue";

const selectedCosts = defineModel<number[]>();
</script>
