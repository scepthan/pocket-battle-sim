<template>
  <v-dialog v-model="energyDialog" max-width="380px">
    <template #activator="{ props }">
      <v-btn
        v-bind="props"
        class="rounded-pill"
        :color="setManually === false ? 'pink-lighten-4' : ''"
      >
        <div class="d-flex ga-2">
          <EnergyIcon
            v-for="(type, index) in energyDisplay"
            :key="index"
            :energy="type"
            width="24px"
          />
        </div>
      </v-btn>
    </template>

    <v-card>
      <v-card-title class="d-flex align-center w-100">
        <span>Select Energy Types (up to 3)</span>
        <v-spacer />
        <v-btn icon="mdi-restore" variant="flat" @click="emit('reset')" />
      </v-card-title>

      <v-card-text>
        <v-chip-group v-model="energyTypes" mandatory multiple column :max="3">
          <v-chip
            v-for="type in filteredEnergyTypes"
            :key="type"
            :value="type"
            :color="energyTypes.includes(type) ? 'purple' : ''"
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
        <span v-if="setManually !== undefined" class="pl-4">
          Selected {{ setManually ? "manually" : "automatically" }}
        </span>
        <v-spacer />
        <v-btn @click="energyDialog = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { type Energy, EnergyMap, sortedBy } from "@/core";

const energyDialog = ref(false);

const energyTypes = defineModel<Energy[]>("modelValue", {
  default: () => ["Grass"],
});
defineProps<{
  setManually?: boolean;
}>();
const emit = defineEmits<{
  (e: "reset"): void;
}>();

const energyDisplay = computed(() =>
  sortedBy(energyTypes.value, (x) => x, Object.values(EnergyMap)),
);

const filteredEnergyTypes = computed(
  () => Object.values(EnergyMap).filter((x) => !["Colorless", "Dragon"].includes(x)) as Energy[],
);
</script>
