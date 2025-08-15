export const randomElement = <T>(arr: T[]) => arr[(Math.random() * arr.length) | 0];
