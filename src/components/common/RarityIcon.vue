<template>
  <span v-if="rarity === 'SAR'">&#x1F308;</span
  ><v-img v-for="i in count" :key="i" :src="icon" :height="height" :width="width" />
</template>

<script setup lang="ts">
import { Crown, Diamond, Shiny, Star } from "@/assets/img/rarity";

export interface Props {
  rarity: string;
}
const props = defineProps<Props>();

const rarityOrder = ["C", "U", "R", "RR", "AR", "SR", "SAR", "IM", "S", "SSR", "UR"];

const icon = computed(() => {
  const rarity = props.rarity;
  if (rarity === "UR") return Crown;
  if (rarity === "S" || rarity === "SSR") return Shiny;
  if (rarity === "AR" || rarity === "SR" || rarity === "SAR" || rarity === "IM") return Star;
  return Diamond;
});

const height = ref(20);
const width = computed(
  () =>
    height.value *
    (icon.value === Shiny ? 0.8 : icon.value === Diamond ? 0.7 : icon.value === Star ? 0.9 : 1)
);

const count = computed(() => {
  const rarity = props.rarity;
  if (rarity === "RR") return 4;
  if (rarity === "R" || rarity === "IM") return 3;
  if (rarity === "U" || rarity === "SR" || rarity === "SAR" || rarity === "SSR") return 2;
  return 1;
});
</script>
