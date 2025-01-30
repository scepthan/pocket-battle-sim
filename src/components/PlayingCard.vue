<template>
  <div :class="{ 'flip-card': true }" :style="style">
    <div class="flip-card-inner">
      <div class="flip-card-front stacked">
        <img :src="cardURL" :height="height" />
        <div
          v-if="hp !== undefined"
          class="card-hp d-flex flex-column align-end"
          :style="{ fontSize: height / 8 + 'px' }"
        >
          {{ Math.floor(hp) }}
          <div
            class="stacked"
            :style="{
              width: '25%',
              height: '4%',
              marginTop: '-5%',
            }"
          >
            <div
              class="d-flex flex-row"
              :style="{
                width: 'calc(100% - 3px)',
                height: 'calc(100% - 3px)',
                marginTop: '1.5px',
                marginLeft: '1.5px',
              }"
            >
              <div
                :style="{
                  width: hpPercent + '%',
                  backgroundColor: '#2F0',
                }"
              />
              <div
                :style="{
                  width: 100 - hpPercent + '%',
                  backgroundColor: '#333',
                }"
              />
            </div>

            <div
              :style="{
                border: '2px solid #333',
                borderRadius: '4px',
              }"
            ></div>
          </div>
        </div>
      </div>
      <div class="flip-card-back">
        <img :src="cardBackUrl" :height="height" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import cardBackUrl from "@/assets/cardback.jpg";

export interface Props {
  heightPx?: number;
  cardId?: string;
  hp?: number;
  baseHp?: number;
}
const props = defineProps<Props>();

const cardURL = computed(() =>
  props.cardId
    ? `https://static.dotgg.gg/pokepocket/card/${props.cardId}.webp`
    : cardBackUrl
);

const ratio = 367 / 512;
const height = computed(() => props.heightPx ?? 200);
const width = computed(() => height.value * ratio);

const hpPercent = computed(() =>
  props.hp && props.baseHp ? (props.hp / props.baseHp) * 100 : 0
);

const style = computed(() => ({
  width: width.value + "px",
  height: height.value + "px",
}));
</script>

<style scoped>
.stacked {
  display: grid;
}
.stacked * {
  grid-row: 1;
  grid-column: 1;
}
.card-hp {
  text-align: right;
  margin-top: -6%;
  user-select: none;

  font-weight: bold;
  color: black;
  text-shadow: 0 0.07em 0.04em white, 0.07em 0.07em 0.04em white,
    0.07em 0 0.04em white, 0.07em -0.07em 0.04em white, 0 -0.07em 0.04em white,
    -0.07em -0.07em 0.04em white, -0.07em 0 0.04em white,
    -0.07em 0.07em 0.04em white;
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
