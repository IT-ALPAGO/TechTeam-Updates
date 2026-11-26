/**
 * Categorical colours for projects.
 *
 * Seven fixed hues, stepped for a dark surface and validated as a set:
 * lightness band, chroma floor, colour-vision-deficiency separation
 * (worst adjacent pair ΔE 10.1), normal-vision separation (ΔE 21.1) and
 * ≥3:1 contrast against the card background all pass.
 *
 * Slots are handed out in first-seen order and never reassigned, so a project
 * keeps its colour when the date range changes and the series count shifts.
 * Hues are never cycled: the eighth project onward folds into "Other".
 */
const SLOTS = [
  '#338ced', // blue
  '#e76624', // orange
  '#00a888', // aqua
  '#d28e05', // yellow
  '#e24d8b', // magenta
  '#0aac23', // green
  '#9887ef', // violet
] as const;

export const OTHER_COLOR = '#8d939b';
export const OTHER_KEY = '__other__';
export const MAX_SERIES = SLOTS.length;

const assigned = new Map<string, string>();

/**
 * Register the project keys that are about to be drawn, in the order they will
 * be drawn. Pass only the series that get their own colour — anything beyond
 * the slot count folds into "Other", so registering the full project list here
 * would hand slots to projects the chart never shows and leave visible ones grey.
 *
 * Assignments are permanent for the session: a project keeps its colour when
 * the date range changes and the series count shifts.
 */
export function registerProjects(keys: string[]): void {
  for (const key of keys) {
    if (!assigned.has(key) && assigned.size < SLOTS.length) {
      assigned.set(key, SLOTS[assigned.size]);
    }
  }
}

export function colorFor(key: string): string {
  return assigned.get(key) ?? OTHER_COLOR;
}

export function hasSlot(key: string): boolean {
  return assigned.has(key);
}
