<template>
  <div class="card-container">
    <div class="d-inline-block">
      <slot />
      <div v-for="i of count" :key="i" class="hand-card" :style="cardStyle">
        <slot name="card" :index="i" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface Props {
  count: number;
}
const props = defineProps<Props>();

const ratio = 367 / 512;
const cardHeight = ref(200);
const cardWidth = ref(cardHeight.value * ratio);

const maxWidth = ref(360);
const cardMargin = computed(
  () => (maxWidth.value - 1 - cardWidth.value) / (props.count - 1) - cardWidth.value
);
const baseMargin = ref(-100);

const cardStyle = computed(() => ({
  marginRight: Math.min(cardMargin.value, baseMargin.value) + "px",
}));
</script>

<style scoped>
.card-container {
  width: 364px;
  height: 230px;
}
.hand-card {
  float: left;
}
.hand-card:last-child {
  margin-right: 0px !important;
}
</style>
