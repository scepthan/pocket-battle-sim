<template>
  <v-dialog v-model="dialog" width="640">
    <template #activator="{ props: dialog }">
      <v-tooltip location="center" :text="String(deckSize)">
        <template #activator="{ props: tooltip }">
          <div v-bind="mergeProps(dialog, tooltip)" class="d-inline-block cursor-pointer">
            <PlayingCard v-if="deckSize > 0" :height-px="100" />
            <InPlayCardSlot v-else :height-px="100" />
          </div>
        </template>
      </v-tooltip>
    </template>

    <CardDisplayDialog
      :title="`Cards in Deck (${deck.length})` + (hand ? ` and Hand (${hand.length})` : '')"
      :cards="sortedCards"
      @close="dialog = false"
    />
  </v-dialog>
</template>

<script setup lang="ts">
import type { PlayingCard as TPlayingCard } from "@/core";
import { computed, mergeProps, ref } from "vue";
import PlayingCard from "../common/PlayingCard.vue";
import CardDisplayDialog from "./CardDisplayDialog.vue";
import InPlayCardSlot from "./InPlayCardSlot.vue";

export interface Props {
  deck: TPlayingCard[];
  hand?: TPlayingCard[];
}
const props = defineProps<Props>();

const dialog = ref(false);

const deckSize = computed(() => props.deck.length);
const sortedCards = computed(() =>
  props.deck.concat(props.hand ?? []).sort((a, b) => a.ID.localeCompare(b.ID))
);
</script>
