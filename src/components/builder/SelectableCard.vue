<template>
  <v-card :style="style" @click="cardClicked" @contextmenu.prevent="cardUnclicked">
    <v-overlay
      persistent
      :model-value="count > 0"
      contained
      scrim="white"
      class="justify-center align-end"
    >
      <div class="px-4 py-2 bg-purple-darken-4 text-white">{{ count }}</div>
    </v-overlay>
    <PlayingCard :card="card" :height-px="height" />
  </v-card>
</template>

<script setup lang="ts">
import type { PlayingCard } from "@/core";

export interface Props {
  card: PlayingCard;
  heightPx?: number;
}
const props = defineProps<Props>();

const selectedCards = defineModel<PlayingCard[]>("selected-cards", { required: true });

const count = computed(() => selectedCards.value.filter((x) => x.ID == props.card.ID).length);

const cardClicked = () => {
  if (selectedCards.value.filter((x) => x.Name == props.card.Name).length < 2) {
    selectedCards.value.push(props.card);
  }
};
const cardUnclicked = () => {
  if (selectedCards.value.includes(props.card)) {
    selectedCards.value.splice(selectedCards.value.lastIndexOf(props.card), 1);
  }
};

const ratio = 367 / 512;
const height = computed(() => props.heightPx ?? 200);
const width = computed(() => height.value * ratio);

const style = computed(() => ({
  width: width.value + "px",
  height: height.value + "px",
}));
</script>
