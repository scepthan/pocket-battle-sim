<template>
  <div class="d-flex flex-column align-center ga-2" :class="{ 'flex-column-reverse': reverse }">
    <v-row no-gutters class="align-center">
      <InPlayCardSlot :card="player?.ActivePokemon ?? EmptyCardSlot.Active()" />
    </v-row>
    <v-row no-gutters class="align-center ga-1">
      <InPlayCardSlot
        v-for="i in 3"
        :key="i"
        :card="player?.Bench[i - 1] ?? EmptyCardSlot.Bench(i - 1)"
        :height-px="140"
      />
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { EmptyCardSlot, type Player } from "@/core";

export interface Props {
  player: Player | undefined;
  reverse?: boolean;
}
defineProps<Props>();
</script>
