import * as agents from "./agents";

export * from "./agents";
export * from "./gamelogic";
export * from "./logging";
export * from "./parsing";
export * from "./util";

export const allAgents = agents as Record<string, (typeof agents)[keyof typeof agents]>;
