<template>
  <v-chip-group v-model="modelValue" mandatory color="#d0d">
    <v-chip :value="false">No</v-chip>
    <v-chip :value="null">Any</v-chip>
    <v-chip :value="true">Yes</v-chip>
  </v-chip-group>
</template>

<script setup lang="ts">
const modelValue = defineModel<boolean | null>();
</script>
