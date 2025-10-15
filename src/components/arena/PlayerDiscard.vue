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
import type { PlayingCard as TPlayingCard } from "@/core";
import { mergeProps, ref } from "vue";
import PlayingCard from "../common/PlayingCard.vue";
import CardDisplayDialog from "./CardDisplayDialog.vue";
import InPlayCardSlot from "./InPlayCardSlot.vue";

export interface Props {
  cards: TPlayingCard[];
}
defineProps<Props>();

const dialog = ref(false);
</script>
