<template>
  <p>{{ selector.text.value ?? defaultText }}</p>
  <div class="d-flex flex-wrap ga-2">
    <v-btn v-for="(option, i) in selector.options.value" :key="i" @click="selector.select(option)">
      {{ buttonText(option) }}
    </v-btn>
    <v-btn v-if="selector.addReadyButton.value" color="green" @click="selector.select(null)">
      Ready
    </v-btn>
    <v-btn v-if="selector.addCancelButton.value" color="red" @click="selector.select('cancel')">
      Cancel
    </v-btn>
  </div>
</template>

<script setup lang="ts" generic="T">
import type { useSelectionHandler } from "@/composables";

defineProps<{
  selector: ReturnType<typeof useSelectionHandler<T>>;
  buttonText: (input: T) => string;
  defaultText: string;
}>();
</script>
