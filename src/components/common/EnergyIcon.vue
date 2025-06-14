<template>
  <img class="energy-icon" :src="energyUrl" :title="energy" />
</template>

<script setup lang="ts">
import type { Energy } from "@/types/Energy";
import { computed } from "vue";
import * as Energies from "@/assets/img/energy";

export interface Props {
  energy: Energy;
}

const props = defineProps<Props>();

const energyUrl = computed(() => Energies[props.energy]);
</script>
