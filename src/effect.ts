import * as Effect from "effect/Effect";

/**
 * Creates an Effect from a Promise-based function
 * @template E The type of error that can occur
 * @template A The type of the successful result
 * @param fn The async function to wrap in an Effect
 * @returns An Effect that wraps the async function
 */
export const createEffect = <E = never, A = never>(
  fn: () => Promise<A>,
): Effect.Effect<A, E, never> => {
  return Effect.tryPromise({
    try: fn,
    catch: (error) => error as E,
  });
};

/**
 * Creates an Effect that automatically updates the store state
 * @template T The type of the store's state
 * @template E The type of error that can occur
 * @template A The type of the successful result
 * @param effect The base effect to wrap
 * @param successState Function to update state on success
 * @param errorState Function to update state on error
 * @returns An Effect that updates the store state
 */
export const createEffectWithState = <T, E, A>(
  effect: Effect.Effect<A, E, never>,
  successState: (result: A) => Partial<T>,
  errorState: (error: E) => Partial<T>,
): Effect.Effect<A, E, never> => {
  return Effect.tap(
    Effect.mapError(effect, (error) => {
      errorState(error);
      return error;
    }),
    (result) => {
      successState(result);
      return Effect.succeed(undefined);
    },
  );
};

/**
 * Creates an Effect with success and error callbacks
 * @template E The type of error that can occur
 * @template A The type of the successful result
 * @param effect The base effect to wrap
 * @param options Callback options for success and error cases
 * @returns An Effect with the specified callbacks
 */
export const createEffectWithCallback = <E, A>(
  effect: Effect.Effect<A, E, never>,
  options: {
    onSuccess?: (result: A) => void;
    onError?: (error: E) => void;
  } = {},
): Effect.Effect<A, E, never> => {
  return Effect.tap(
    Effect.mapError(effect, (error) => {
      options.onError?.(error);
      return error;
    }),
    (result) => {
      options.onSuccess?.(result);
      return Effect.succeed(undefined);
    },
  );
};
