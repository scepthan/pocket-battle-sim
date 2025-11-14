<template>
  <v-tooltip :text="tooltip" location="top">
    <template v-slot:activator="{ props }">
      <v-btn v-bind="mergeProps($attrs, props)" />
    </template>
  </v-tooltip>
</template>

<script setup lang="ts">
import { mergeProps } from "vue";

export interface Props {
  tooltip: string;
}
defineProps<Props>();
</script>
