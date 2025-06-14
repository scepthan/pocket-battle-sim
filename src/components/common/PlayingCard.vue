<template>
  <div class="flip-card" :style="style">
    <div class="flip-card-inner">
      <div class="flip-card-front">
        <img :src="cardURL" :height="height" />
      </div>
      <div class="flip-card-back">
        <img :src="cardBackUrl" :height="height" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import cardBackUrl from "@/assets/img/cardback.jpg";
import type { PlayingCard } from "@/types/PlayingCard";
import { computed } from "vue";

export interface Props {
  heightPx?: number;
  card?: PlayingCard;
}
const props = defineProps<Props>();

const cardURL = computed(() =>
  props.card
    ? `https://static.dotgg.gg/pokepocket/card/${props.card.ID}.webp`
    : cardBackUrl
);

const ratio = 367 / 512;
const height = computed(() => props.heightPx ?? 200);
const width = computed(() => height.value * ratio);

const style = computed(() => ({
  width: width.value + "px",
  height: height.value + "px",
}));
</script>

<style scoped>
.flip-card {
  perspective: 600px;
}
.flip-card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  text-align: center;
  transition: transform 0.8s;
  transform-style: preserve-3d;
}
.flip-card.flippable:hover .flip-card-inner {
  transform: rotateY(-180deg);
}
.flip-card-front,
.flip-card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
}
.flip-card-front {
  background-color: #bbb;
  color: black;
}
.flip-card-back {
  transform: rotateY(180deg);
}
</style>
