<template>
  <v-row>
    <v-col cols="6">
      <v-select
        v-model="selectedMin"
        :items="minOptions"
        label="Min"
        density="comfortable"
        v-bind="$attrs"
      />
    </v-col>
    <v-col cols="6">
      <v-select
        v-model="selectedMax"
        :items="maxOptions"
        label="Max"
        density="comfortable"
        v-bind="$attrs"
      />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { usePlayingCardStore } from "@/stores";

const selectedMin = defineModel<number | null>("minHp");
const selectedMax = defineModel<number | null>("maxHp");

const { Cards } = usePlayingCardStore();

const minHp = ref(999);
const maxHp = ref(0);

for (const card of Cards) {
  if (card.CardType !== "Pokemon") continue;
  if (card.BaseHP < minHp.value) minHp.value = card.BaseHP;
  if (card.BaseHP > maxHp.value) maxHp.value = card.BaseHP;
}

const minOptions = computed(() => {
  const output: (number | null)[] = [null];
  for (let hp = minHp.value; hp <= (selectedMax.value ?? maxHp.value); hp += 10) output.push(hp);
  return output;
});

const maxOptions = computed(() => {
  const output: (number | null)[] = [null];
  for (let hp = selectedMin.value ?? minHp.value; hp <= maxHp.value; hp += 10) output.push(hp);
  return output;
});
</script>
