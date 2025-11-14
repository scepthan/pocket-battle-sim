<template>
  <v-menu
    v-for="(option, i) in menuOptions"
    :key="i"
    :open-on-hover="!!option.items"
    :disabled="!option.items"
    no-click-animation
  >
    <template #activator="{ props }">
      <v-btn v-bind="props" @click="goTo(option.route)">{{ option.title }}</v-btn>
    </template>

    <v-list density="compact">
      <v-list-item v-for="(item, j) in option.items" :key="j" @click="goTo(item.route)">
        <v-list-item-title>{{ item.title }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
const router = useRouter();

const menuOptions = [
  { title: "Arena", route: "/arena" },
  { title: "Decks", route: "/decks", items: [{ title: "Deck Builder", route: "/decks/builder" }] },
  { title: "Mass Simulator", route: "/simulator" },
];

const goTo = async (route: string) => {
  if (router.currentRoute.value.path !== route) {
    await router.push(route);
  }
};
</script>
