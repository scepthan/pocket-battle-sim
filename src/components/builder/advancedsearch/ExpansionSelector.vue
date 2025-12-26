<template>
  <v-select
    v-model="selectedExpansions"
    :items="Object.entries(allExpansions).reverse()"
    :item-title="([set, name]) => `${set} - ${name}`"
    item-value="0"
    multiple
    chips
    closable-chips
  />
</template>

<script setup lang="ts">
import { allExpansions } from "@/assets";

const selectedExpansions = defineModel<string[]>();
</script>
