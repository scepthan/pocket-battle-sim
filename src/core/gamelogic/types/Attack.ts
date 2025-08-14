import type { BasicEffect } from "./BasicEffect";
import type { Energy } from "./Energy";

export interface Attack {
  Name: string;
  RequiredEnergy: Energy[];
  Effect: BasicEffect;
  Text?: string;
  Damage?: number;
}
