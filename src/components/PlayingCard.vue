<template>
  <div :class="{ 'flip-card': true, flippable: !!cardId }" :style="style">
    <div class="flip-card-inner">
      <div class="flip-card-front stacked-card">
        <img :src="cardURL" :height="height" />
        <div
          v-if="hp !== undefined"
          class="card-hp"
          :style="{ fontSize: height / 10 + 'px' }"
        >
          {{ hp }}
        </div>
      </div>
      <div class="flip-card-back">
        <img :src="imgUrl" :height="height" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import imgUrl from "@/assets/cardback.jpg";

export interface Props {
  cardId?: string;
  hp?: number;
}
const props = defineProps<Props>();

const cardURL = computed(() =>
  props.cardId
    ? `https://static.dotgg.gg/pokepocket/card/${props.cardId}.webp`
    : imgUrl
);

const ratio = 367 / 512;
const height = ref<number>(200);
const width = computed(() => height.value * ratio);
const style = computed(() => ({
  width: width.value + "px",
  height: height.value + "px",
}));
</script>

<style scoped>
.stacked-card {
  display: grid;
  user-select: none;
}
.stacked-card * {
  grid-row: 1;
  grid-column: 1;
}
.card-hp {
  text-align: right;
  padding-right: 4%;

  color: white;
  text-shadow: 0.05em 0 black, 0 0.05em black, -0.05em 0 black, 0 -0.05em black,
    -0.05em -0.05em black, -0.05em 0.05em black, 0.05em -0.05em black,
    0.05em 0.05em black;
}

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
