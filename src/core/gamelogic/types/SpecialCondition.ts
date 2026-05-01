import type { ParsedResult } from "@/core/parsing";

export type PrimaryCondition = "Asleep" | "Paralyzed" | "Confused";
export type SecondaryCondition = "Poisoned" | "Poisoned+" | "Burned";
export type SpecialCondition = PrimaryCondition | SecondaryCondition;

export const isSpecialCondition = (condition: string): condition is SpecialCondition => {
  return ["Asleep", "Paralyzed", "Confused", "Poisoned", "Poisoned+", "Burned"].includes(condition);
};

export const parseSpecialConditions = (conditions: string): ParsedResult<SpecialCondition[]> => {
  let parseSuccessful = true;
  const allConditions = conditions.split(" and ");
  const conditionList = allConditions.filter((c) => isSpecialCondition(c));
  if (conditionList.length < allConditions.length) {
    console.warn(
      `Could not parse all conditions from "${conditions}": parsed ${conditionList.join(", ")}`,
    );
    parseSuccessful = false;
  }
  return { value: conditionList, parseSuccessful };
};
