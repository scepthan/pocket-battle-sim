<template>
  <p>{{ selector.prompt.value ?? defaultPrompt }}</p>
  <div class="d-flex flex-wrap ga-2">
    <v-btn v-for="(option, i) in selector.options.value" :key="i" @click="selector.select(option)">
      {{ buttonText(option) }}
    </v-btn>
    <v-btn v-if="selector.allowReady.value" color="green" @click="selector.select(READY_OPTION)">
      Ready
    </v-btn>
    <v-btn v-if="selector.allowCancel.value" color="red" @click="selector.select(CANCEL_OPTION)">
      Cancel
    </v-btn>
  </div>
</template>

<script setup lang="ts" generic="T">
import { CANCEL_OPTION, READY_OPTION, type SelectionHandler } from "@/composables";

defineProps<{
  selector: SelectionHandler<T>;
  buttonText: (input: T) => string;
  defaultPrompt: string;
}>();
</script>
