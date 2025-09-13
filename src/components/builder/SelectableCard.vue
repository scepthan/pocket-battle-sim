<template>
  <v-card :style="style">
    <v-overlay
      persistent
      :model-value="count > 0"
      contained
      scrim="white"
      class="justify-center align-end"
    >
      <div class="px-4 py-2 bg-purple-darken-4 text-white">{{ count }}</div>
    </v-overlay>
    <PlayingCard :card="card" :height-px="height" v-on="$attrs" />
  </v-card>
</template>

<script setup lang="ts">
import type { PlayingCard } from "@/core";
import { computed } from "vue";

export interface Props {
  card: PlayingCard;
  count: number;
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
