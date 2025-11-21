<template>
  <v-chip-group v-model="selectedRarities" multiple column>
    <v-chip v-for="(rarity, i) in rarityOrder" :key="i" :value="rarity" color="#f0f">
      <RarityIcon :rarity="rarity" />
    </v-chip>
  </v-chip-group>

  <v-switch v-model="disableArtFilter" label="Disable art (saved)" class="my-n3" />
</template>

<script setup lang="ts">
import { rarityShort } from "@/assets";
import { useDisableArtFilter } from "@/composables";

const selectedRarities = defineModel<string[]>();

const rarityOrder = computed(() => rarityShort.slice(0, disableArtFilter.value ? 4 : Infinity));

const { disableArtFilter } = useDisableArtFilter();
</script>
