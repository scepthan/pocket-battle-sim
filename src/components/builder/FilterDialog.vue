<template>
  <v-dialog v-model="filterDialog" max-width="640px">
    <template #activator="{ props }">
      <v-btn v-bind="props" icon="mdi-filter" />
    </template>

    <v-card>
      <v-card-title>Select Filters</v-card-title>

      <v-card-text>
        <FilterDialogRow label="Is Pokémon?">
          <Toggle3Way v-model="filters.isPokemon" />
        </FilterDialogRow>
        <FilterDialogRow label="Pokémon type">
          <MiniEnergySelector v-model="filters.type" :disabled="filters.isPokemon === false" />
        </FilterDialogRow>
        <FilterDialogRow label="Stage">
          <MiniStageSelector v-model="filters.stage" :disabled="filters.isPokemon === false" />
        </FilterDialogRow>
        <FilterDialogRow label="Is Pokémon ex?">
          <Toggle3Way v-model="filters.isEx" :disabled="filters.isPokemon === false" />
        </FilterDialogRow>
        <!-- <FilterDialogRow label="Is Mega Pokémon?">
          <Toggle3Way v-model="filters.isMega" :disabled="filters.isPokemon === false" />
        </FilterDialogRow> -->
        <!-- <FilterDialogRow label="Is Ultra Beast?">
          <Toggle3Way v-model="filters.isUltraBeast" :disabled="filters.isPokemon === false" />
        </FilterDialogRow> -->
        <FilterDialogRow label="Has Ability?">
          <Toggle3Way v-model="filters.hasAbility" :disabled="filters.isPokemon === false" />
        </FilterDialogRow>
        <FilterDialogRow label="Weakness">
          <MiniWeaknessSelector
            v-model="filters.weakness"
            :disabled="filters.isPokemon === false"
          />
        </FilterDialogRow>
        <FilterDialogRow label="Trainer type">
          <MiniTrainerTypeSelector v-model="filters.trainerType" :disabled="filters.isPokemon" />
        </FilterDialogRow>
        <FilterDialogRow label="Card rarity">
          <MiniRaritySelector v-model="filters.rarity" />
        </FilterDialogRow>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn @click="filterDialog = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { SearchFilters } from "@/types/SearchFilters";

const filterDialog = ref(false);

const filters = defineModel<SearchFilters>("modelValue", { required: true });
</script>

<style scoped>
.v-row {
  align-items: center;
}
</style>
