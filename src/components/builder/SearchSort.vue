<template>
  <v-menu>
    <template #activator="{ props: menuProps }">
      <v-btn icon="mdi-sort" v-bind="menuProps" />
    </template>

    <v-list>
      <v-list-item v-for="(sorter, title) in sortOptions" :key="title" @click="sortBy = sorter">
        <v-list-item-title>{{ title }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { allRarities } from "@/assets";
import { allTypes, type PlayingCard, type Sortable } from "@/core";

export type CardSorter = (card: PlayingCard) => Sortable;

const sortBy = defineModel<CardSorter>();

const sortOptions: Record<string, CardSorter> = {
  "Card ID": (card) => card.id,
  Type: (card) =>
    card.cardType === "Pokemon"
      ? allTypes.indexOf(card.type)
      : 10 + ["Fossil", "PokemonTool", "Item", "Supporter"].indexOf(card.cardType),
  Rarity: (card) => Object.keys(allRarities).indexOf(card.rarity),
  Name: (card) => card.name,
  HP: (card) => (card.cardType === "Pokemon" ? card.baseHP : 999),
};
</script>
