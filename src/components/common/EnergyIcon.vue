<template>
  <img :class="classList" :src="energyUrl" :title="energy" />
</template>

<script setup lang="ts">
import * as Energies from "@/assets/img/energy";
import type { Energy } from "@/core";

export interface Props {
  energy: Energy;
  inline?: boolean;
}

const props = defineProps<Props>();
const classList = computed(() => {
  return {
    "energy-icon": true,
    "d-inline": !!props.inline,
    "d-block": !props.inline,
  };
});

const energyUrl = computed(() => Energies[props.energy]);
</script>
