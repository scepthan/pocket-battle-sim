<template>
  <v-dialog v-model="dialog" width="640">
    <template #activator="{ props: dialogProps }">
      <v-tooltip location="center" :text="String(deckSize)">
        <template #activator="{ props: tooltipProps }">
          <div v-bind="mergeProps(dialogProps, tooltipProps)" class="d-inline-block cursor-pointer">
            <PlayingCard v-if="deckSize > 0" :height-px="100" />
            <InPlayCardSlot v-else :height-px="100" />
          </div>
        </template>
      </v-tooltip>
    </template>

    <CardDisplayDialog :title="dialogTitle" :cards="sortedCards" @close="dialog = false" />
  </v-dialog>
</template>

<script setup lang="ts">
import type { PlayingCard as TPlayingCard } from "@/core";
import { mergeProps } from "vue";

export interface Props {
  deck: TPlayingCard[];
  handSize?: number;
}
const props = defineProps<Props>();

const dialog = ref(false);

const deckSize = computed(() => props.deck.length);
const sortedCards = computed(() => props.deck.slice().sort((a, b) => a.ID.localeCompare(b.ID)));

const dialogTitle = computed(() => {
  let title = `Cards in Deck (${props.deck.length})`;
  if (props.handSize !== undefined) title += ` and Hand (${props.handSize})`;
  return title;
});
</script>
