<template>
  <v-dialog v-model="dialog" width="auto">
    <template #activator="{ props: dialog }">
      <v-tooltip location="center" :text="String(displayCount)">
        <template #activator="{ props: tooltip }">
          <div v-bind="mergeProps(dialog, tooltip)" class="d-inline-block">
            <PlayingCard v-if="displayCount > 0" :height-px="100" />
            <InPlayCardSlot v-else :height-px="100" />
          </div>
        </template>
      </v-tooltip>
    </template>

    <v-card style="max-width: 640px">
      <v-toolbar>
        <v-toolbar-title>
          Cards in Deck<span v-if="displayCount !== cards.length"> and Hand</span>
        </v-toolbar-title>
        <v-toolbar-items>
          <v-btn icon="mdi-close" @click="dialog = false"></v-btn>
        </v-toolbar-items>
      </v-toolbar>

      <v-card-text>
        <div class="d-flex flex-wrap" style="gap: 8px">
          <PlayingCard
            v-for="(card, index) in sortedCards"
            :key="index"
            :card="card"
            :height-px="150"
          />
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { PlayingCard as TPlayingCard } from "@/core";
import { computed, mergeProps, ref } from "vue";
import PlayingCard from "../common/PlayingCard.vue";
import InPlayCardSlot from "./InPlayCardSlot.vue";

export interface Props {
  cards: TPlayingCard[];
  count?: number;
}
const props = defineProps<Props>();

const dialog = ref(false);

const displayCount = computed(() => props.count ?? props.cards.length);
const sortedCards = computed(() => props.cards.slice().sort((a, b) => a.ID.localeCompare(b.ID)));
</script>
