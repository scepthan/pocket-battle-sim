<template>
  <span v-if="rarity === 'SAR'">&#x1F308;</span
  ><v-img v-for="i in count" :key="i" :src="icon" :height="height" :width="width" />
</template>

<script setup lang="ts">
import { allRarities } from "@/assets";
import * as icons from "@/assets/img/rarity";

export interface Props {
  rarity: keyof typeof allRarities;
}
const props = defineProps<Props>();

const rarityObj = computed(() => allRarities[props.rarity]);
const icon = computed(() => icons[rarityObj.value.icon]);
const count = computed(() => rarityObj.value.count);

const height = ref(20);
const width = computed(() => {
  const multiplier = { Diamond: 0.7, Star: 0.9, Shiny: 0.8, Crown: 1 }[rarityObj.value.icon];
  return height.value * multiplier;
});
</script>
