/**
 * @file Small asynchronous primitives.
 *
 * @module lib/shared/async
 */

/**
 * Resolves after the given number of milliseconds.
 *
 * Injected as a dependency wherever code waits, so tests can replace it with
 * an instant fake and run deterministically.
 *
 * @param milliseconds - Delay before the promise resolves.
 * @returns A promise that resolves with `undefined`.
 */
export function sleep(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
