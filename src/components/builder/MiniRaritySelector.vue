<template>
  <v-chip-group v-model="selectedRarities" multiple column>
    <v-chip v-for="(rarity, i) in rarityOrder" :key="i" :value="rarity" color="#f0f">
      <RarityIcon :rarity="rarity" />
    </v-chip>
  </v-chip-group>

  <v-switch label="Disable art (saved)" v-model="disableArtFilter" />
</template>

<script setup lang="ts">
import { useDisableArtFilter } from "@/composables";

const selectedRarities = defineModel<string[]>();

const rarityOrder = computed(() =>
  ["C", "U", "R", "RR", "AR", "SR", "SAR", "IM", "S", "SSR", "UR"].slice(
    0,
    disableArtFilter.value ? 4 : Infinity
  )
);

const { disableArtFilter } = useDisableArtFilter();
</script>
