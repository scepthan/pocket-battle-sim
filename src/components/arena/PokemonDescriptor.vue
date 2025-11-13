<template>
  <span>
    <template v-for="(part, index) in parsed" :key="index">
      <span v-if="typeof part === 'string'">{{ part }}</span>
      <EnergyIcon v-else-if="part.type === 'energy'" :energy="part.content" inline />
    </template>
  </span>
</template>

<script setup lang="ts">
import { parseEnergy } from "@/core";

export interface Props {
  text?: string;
}
const props = defineProps<Props>();

const parsed = computed(() => {
  const descriptor = props.text || "Pokémon";
  const parts = [];
  const regex = /\{(\w)\}/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(descriptor)) !== null) {
    if (match.index > lastIndex) {
      parts.push(descriptor.slice(lastIndex, match.index));
    }
    parts.push({ type: "energy", content: parseEnergy(match[1]!) });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < descriptor.length) {
    parts.push(descriptor.slice(lastIndex));
  }

  return parts;
});
</script>

<style scoped>
.energy-icon {
  height: 1.25em;
  margin-bottom: -4px;
}
</style>
