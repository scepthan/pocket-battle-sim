<template>
  <div class="card-container">
    <v-tooltip location="bottom" :text="String(cards)">
      <template #activator="{ props }">
        <div v-bind="props" class="d-inline-block">
          <div v-for="(card, i) of cards" :key="i" class="hand-card">
            <PlayingCard :height-px="200" />
          </div>
        </div>
      </template>
    </v-tooltip>
  </div>
</template>

<script setup lang="ts">
export interface Props {
  cards: number;
}
defineProps<Props>();
</script>

<style scoped>
.card-container {
  width: 534px;
  height: 230px;
}
.hand-card {
  margin-right: -100px;
  float: left;
}
.hand-card:last-child {
  margin-right: 0px !important;
}
</style>
