<template>
  <v-tooltip location="center" :text="String(displayCount)">
    <template #activator="{ props }">
      <div v-bind="props" class="d-inline-block">
        <PlayingCard v-if="displayCount > 0" :height-px="100" />
        <InPlayCardSlot v-else :height-px="100" />
      </div>
    </template>
  </v-tooltip>
</template>

<script setup lang="ts">
import type { PlayingCard as TPlayingCard } from "@/core";
import { computed } from "vue";
import PlayingCard from "../common/PlayingCard.vue";
import InPlayCardSlot from "./InPlayCardSlot.vue";

export interface Props {
  cards: TPlayingCard[];
  count?: number;
}
const props = defineProps<Props>();

const displayCount = computed(() => props.count ?? props.cards.length);
</script>
