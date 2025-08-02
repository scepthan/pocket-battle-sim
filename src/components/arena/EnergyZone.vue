<template>
  <div class="stacked energy-zone">
    <div class="current-energy">
      <EnergyIcon v-if="currentEnergy" :width="70" :energy="currentEnergy" />
      <div v-else class="empty-energy" />
    </div>
    <div class="next-energy">
      <EnergyIcon v-if="nextEnergy" :width="25" :energy="nextEnergy" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Energy } from "@/core";

export interface Props {
  currentEnergy: Energy | null;
  nextEnergy: Energy | null;
}
defineProps<Props>();
</script>

<style scoped>
.stacked {
  display: grid;
}
.stacked * {
  grid-row: 1;
  grid-column: 1;
}

.energy-zone {
  height: 70px;
  margin-right: 20px;
}
.empty-energy {
  width: 70px;
  height: 70px;
  background-color: #3333;
  border-radius: 50%;
  border: 2px solid #333a;
}
.next-energy {
  display: flex;
  align-items: end;
}
</style>
