<template>
  <img class="energy-icon d-block" :src="energyUrl" :title="energy" />
</template>

<script setup lang="ts">
import * as Energies from "@/assets/img/energy";
import type { Energy } from "@/core";
import { computed } from "vue";

export interface Props {
  energy: Energy;
}

const props = defineProps<Props>();

const energyUrl = computed(() => Energies[props.energy]);
</script>
