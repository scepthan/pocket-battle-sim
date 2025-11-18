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
import { EnergyMap, type PlayingCard, type Sortable } from "@/core";

export type CardSorter = (card: PlayingCard) => Sortable;

const sortBy = defineModel<CardSorter>();

const sortOptions: Record<string, CardSorter> = {
  "Card ID": (card) => card.ID,
  Type: (card) =>
    card.CardType === "Pokemon"
      ? Object.values(EnergyMap).indexOf(card.Type)
      : 10 + ["Fossil", "PokemonTool", "Item", "Supporter"].indexOf(card.CardType),
  Rarity: (card) => Object.keys(allRarities).indexOf(card.Rarity),
  Name: (card) => card.Name,
  HP: (card) => (card.CardType === "Pokemon" ? card.BaseHP : 999),
};
</script>
