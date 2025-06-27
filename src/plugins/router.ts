import { createRouter, createWebHistory } from "vue-router";

import ArenaView from "@/views/ArenaView.vue";
import DeckBuilderView from "@/views/DeckBuilderView.vue";
import HomeView from "@/views/HomeView.vue";

const routes = [
  { path: "/", component: HomeView },
  { path: "/arena", component: ArenaView },
  { path: "/builder", component: DeckBuilderView },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
