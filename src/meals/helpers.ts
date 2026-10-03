/** Shared helpers for the HOME + MEALS flow. */

/** Local calendar date as YYYY-MM-DD (spec-defined). */
export const todayISO = (): string => new Date().toISOString().slice(0, 10);

/** Date N days from now as YYYY-MM-DD. */
export const plusDaysISO = (days: number): string =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

export type GreetingKey = 'morning' | 'day' | 'evening';

/** Greeting bucket by local hour: <6 or >=18 → evening, <11 → morning, else day. */
export const greetingKey = (hour: number = new Date().getHours()): GreetingKey =>
  hour < 6 || hour >= 18 ? 'evening' : hour < 11 ? 'morning' : 'day';
