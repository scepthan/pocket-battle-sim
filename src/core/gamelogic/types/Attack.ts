import type { BasicEffect } from "./Effects";
import type { Energy } from "./Energy";

export interface Attack {
  Name: string;
  RequiredEnergy: Energy[];
  Effect: BasicEffect;
  Text?: string;
  Damage?: number;
}
