<template>
  <v-dialog v-model="filterDialog" max-width="640px">
    <template #activator="{ props }">
      <v-btn v-bind="props" icon="mdi-filter" />
    </template>

    <v-card>
      <v-card-title class="d-flex align-center w-100">
        <span>Select Filters</span>
        <v-spacer />
        <v-btn icon="mdi-restore" variant="flat" @click="emit('resetFilters')" />
        <v-btn icon="mdi-close" variant="flat" @click="filterDialog = false" />
      </v-card-title>

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
        <!-- <FilterDialogRow label="Is Mega Evolution?">
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
        <FilterDialogRow label="Retreat Cost">
          <MiniRetreatCostSelector
            v-model="filters.retreatCost"
            :disabled="filters.isPokemon === false"
          />
        </FilterDialogRow>
        <FilterDialogRow label="HP">
          <HpSelector
            v-model:min-hp="filters.hpMin"
            v-model:max-hp="filters.hpMax"
            :disabled="filters.isPokemon === false"
          />
        </FilterDialogRow>
        <FilterDialogRow label="Trainer type">
          <MiniTrainerTypeSelector v-model="filters.trainerType" :disabled="filters.isPokemon" />
        </FilterDialogRow>
        <FilterDialogRow label="Card rarity">
          <MiniRaritySelector v-model="filters.rarity" />
        </FilterDialogRow>
        <FilterDialogRow label="Expansion">
          <ExpansionSelector v-model="filters.expansion" />
        </FilterDialogRow>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { SearchFilters } from "@/types/SearchFilters";

const filterDialog = ref(false);

const filters = defineModel<SearchFilters>("modelValue", { required: true });

const emit = defineEmits<{ (e: "resetFilters"): void }>();
</script>

<style scoped>
.v-row {
  align-items: center;
}
</style>
