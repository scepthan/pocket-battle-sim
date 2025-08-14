import type { Game } from "..";

export type BasicEffect = (game: Game) => Promise<void>;
