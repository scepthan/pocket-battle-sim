import { createRouter, createWebHistory } from "vue-router";

import ArenaView from "@/views/ArenaView.vue";
import HomeView from "@/views/HomeView.vue";

const routes = [
  { path: "/", component: HomeView },
  { path: "/arena", component: ArenaView },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
