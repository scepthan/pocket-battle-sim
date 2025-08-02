<template>
  <v-card :style="style">
    <v-overlay :model-value="!selectable" contained />
    <PlayingCard :card="card" v-on="$attrs" />
  </v-card>
</template>

<script setup lang="ts">
import type { PlayingCard } from "@/core";
import { computed } from "vue";

export interface Props {
  card: PlayingCard;
  selectable: boolean;
  heightPx?: number;
}
const props = defineProps<Props>();

const ratio = 367 / 512;
const height = computed(() => props.heightPx ?? 200);
const width = computed(() => height.value * ratio);

const style = computed(() => ({
  width: width.value + "px",
  height: height.value + "px",
}));
</script>
