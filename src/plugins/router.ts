import { createRouter, createWebHistory } from "vue-router";

import ArenaView from "@/views/ArenaView.vue";
import DeckBuilderView from "@/views/DeckBuilderView.vue";
import DecksView from "@/views/DecksView.vue";
import HomeView from "@/views/HomeView.vue";
import MassSimulatorView from "@/views/MassSimulatorView.vue";

const routes = [
  { path: "/", component: HomeView },
  { path: "/arena", component: ArenaView },
  { path: "/decks", component: DecksView },
  { path: "/decks/builder", component: DeckBuilderView },
  { path: "/simulator", component: MassSimulatorView },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
