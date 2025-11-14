<template>
  <span>
    ({{ event.initialHP }}/{{ event.maxHP }} &rarr; {{ event.finalHP }}/{{ event.maxHP }} HP)
  </span>
</template>

<script setup lang="ts">
import type { HpChangeEvent } from "@/core";

export interface Props {
  event: HpChangeEvent;
}
defineProps<Props>();
</script>
