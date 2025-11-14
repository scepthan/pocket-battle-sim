<template>
  <EmptyDeckCard class="d-flex flex-column align-center justify-center" @click="navigate">
    <v-icon size="100px" color="grey">mdi-plus</v-icon>
    <div>Create new</div>
  </EmptyDeckCard>
</template>

<script setup lang="ts">
const router = useRouter();

const navigate = async () => await router.push("/decks/builder");
</script>
