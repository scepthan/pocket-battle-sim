<template>
  <v-dialog v-model="energyDialog" max-width="380px">
    <!-- Energy selector (can select up to 3) -->
    <template #activator="{ props }">
      <v-btn v-bind="props" class="rounded-pill">
        <div class="d-flex ga-2">
          <EnergyIcon
            v-for="(type, index) in energyTypes"
            :key="index"
            :energy="type"
            width="24px"
          />
        </div>
      </v-btn>
    </template>
    <v-card>
      <v-card-title>Select Energy Types (up to 3)</v-card-title>
      <v-card-text>
        <v-chip-group v-model="energyTypes" mandatory multiple column :max="3">
          <v-chip
            v-for="type in filteredEnergyTypes"
            :key="type"
            :value="type"
            :color="energyTypes?.includes(type) ? 'purple' : ''"
            style="width: 150px"
            class="justify-center"
          >
            <template #prepend>
              <v-avatar size="24" class="mr-2">
                <EnergyIcon :energy="type" width="24px" />
              </v-avatar>
            </template>
            {{ type }}
          </v-chip>
        </v-chip-group>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="energyDialog = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { type Energy, EnergyMap } from "@/core";
import { computed, ref } from "vue";

const energyDialog = ref(false);

const energyTypes = defineModel<Energy[]>("modelValue", {
  default: () => ["Grass"],
});

const filteredEnergyTypes = computed(
  () => Object.values(EnergyMap).filter((x) => !["Colorless", "Dragon"].includes(x)) as Energy[]
);
</script>
