<template>
  <v-card
    class="d-flex flex-column align-center justify-center pa-2 text-center"
    width="180"
    height="216"
    @click="navigate"
  >
    <v-icon size="100px" color="grey">mdi-plus</v-icon>
    <div>Create new</div>
  </v-card>
</template>

<script setup lang="ts">
const router = useRouter();

const navigate = () => router.push("/decks/builder");
</script>
