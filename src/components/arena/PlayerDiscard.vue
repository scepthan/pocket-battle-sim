<template>
  <v-dialog v-model="dialog" width="640">
    <template #activator="{ props: dialogProps }">
      <v-tooltip location="center" :text="String(cards.length)">
        <template #activator="{ props: tooltipProps }">
          <div v-bind="mergeProps(dialogProps, tooltipProps)" class="d-inline-block cursor-pointer">
            <PlayingCard v-if="cards.length > 0" :height-px="100" :card="cards[0]" />
            <InPlayCardSlot v-else :height-px="100" />
          </div>
        </template>
      </v-tooltip>
    </template>

    <CardDisplayDialog title="Cards in Discard" :cards="cards" @close="dialog = false" />
  </v-dialog>
</template>

<script setup lang="ts">
import type { PlayingCard } from "@/core";
import { mergeProps } from "vue";

export interface Props {
  cards: PlayingCard[];
}
defineProps<Props>();

const dialog = ref(false);
</script>
