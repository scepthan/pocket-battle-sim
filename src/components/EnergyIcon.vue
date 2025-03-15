<template>
  <img :src="energyUrl" />
</template>

<script setup lang="ts">
import type { Energy } from "@/types/Energy";
import { computed } from "vue";

export interface Props {
  energy: Energy;
}

const props = defineProps<Props>();

const energyUrl = computed(
  () =>
    `https://static.dotgg.gg/pokepocket/icons/${props.energy.toLowerCase()}.png`
);
</script>
