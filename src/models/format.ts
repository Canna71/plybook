// Formatting numbers and dates for display.

/** A date as the system shows dates; "" for none */
export const formatDate = (date?: string) =>
    (date && new Date(date).toLocaleDateString()) || "";

/** `value` rounded to `decimals` places (by exponent, so 1.005 rounds to 1.01) */
export function round(value: number | undefined, decimals: number) {
    if (typeof value !== "number") return value;
    return Number(Math.round(Number(value + "e" + decimals)) + "e-" + decimals);
}
