<template>
  <v-row class="align-center" no-gutters>
    <v-col cols="4">{{ label }}:</v-col>
    <v-col cols="8">
      <slot />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
export interface Props {
  label: string;
}
defineProps<Props>();
</script>
