<template>
  <v-card>
    <v-toolbar>
      <v-toolbar-title>
        {{ title }}
      </v-toolbar-title>
      <v-toolbar-items>
        <v-btn icon="mdi-close" @click="emit('close')"></v-btn>
      </v-toolbar-items>
    </v-toolbar>

    <v-card-text>
      <div class="d-flex flex-wrap" style="gap: 8px">
        <PlayingCard v-for="(card, index) in cards" :key="index" :card="card" :height-px="150" />
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { PlayingCard as TPlayingCard } from "@/core";
import PlayingCard from "../common/PlayingCard.vue";

export interface Props {
  title: string;
  cards: TPlayingCard[];
}
defineProps<Props>();

export interface Emits {
  (e: "close"): void;
}
const emit = defineEmits<Emits>();
</script>
