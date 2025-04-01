import { useCallback, useEffect, useRef, useState } from "react";
import * as Effect from "effect/Effect";
import { EffectStore } from "../../../store";
import { UseAsyncEffectOptions, UseAsyncEffectResult } from "./useAsyncEffect";

/**
 * Hook to execute an effect only if certain conditions are met
 * @template A The type of the result value
 * @template E The type of the error
 * @param effect The Effect to run
 * @param condition The condition that must be met for the effect to run
 * @param options Options for controlling the effect execution
 * @returns Object containing the run function, data, error, and loading state
 *
 * @example
 * ```tsx
 * // Only run the effect if user is logged in
 * const { data, error, isLoading } = useConditionalEffect(
 *   fetchUserProfileEffect,
 *   isLoggedIn,
 *   { immediate: true }
 * );
 *
 * // Run effect manually with condition check
 * const { run, data } = useConditionalEffect(
 *   saveDataEffect,
 *   isFormValid,
 *   { immediate: false }
 * );
 *
 * return <button onClick={run} disabled={!isFormValid || isLoading}>
 *   {isLoading ? 'Saving...' : 'Save'}
 * </button>;
 * ```
 */
export function useConditionalEffect<A, E>(
  effect: Effect.Effect<A, E, never>,
  condition: boolean,
  options: UseAsyncEffectOptions<A, E> = {},
): UseAsyncEffectResult<A, E> {
  const { onSuccess, onError, deps = [], immediate = true } = options;

  const [data, setData] = useState<A | undefined>(undefined);
  const [error, setError] = useState<E | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExecuted, setIsExecuted] = useState<boolean>(false);

  const effectRef = useRef(effect);
  const conditionRef = useRef(condition);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Update refs when deps change
  useEffect(() => {
    effectRef.current = effect;
    conditionRef.current = condition;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [effect, condition, onSuccess, onError, ...deps]);

  const run = useCallback(async () => {
    // Create a conditional effect with proper state management
    const conditionalEffect = Effect.gen(function* ($) {
      // Skip if condition not met
      if (!conditionRef.current) {
        return yield* $(Effect.succeed(undefined));
      }

      yield* $(
        Effect.sync(() => {
          setIsLoading(true);
          setError(undefined);
        }),
      );

      return yield* $(
        effectRef.current,
        // Handle success
        Effect.tap((result) =>
          Effect.sync(() => {
            setData(result);
            onSuccessRef.current?.(result);
          }),
        ),
        // Handle error
        Effect.tapError((err) =>
          Effect.sync(() => {
            setError(err);
            onErrorRef.current?.(err);
          }),
        ),
        // Handle cleanup
        Effect.ensuring(
          Effect.sync(() => {
            setIsLoading(false);
            setIsExecuted(true);
          }),
        ),
      );
    });

    // Run the effect
    await Effect.runPromise(
      Effect.catchAll(conditionalEffect, () => Effect.succeed(undefined)),
    );
  }, []);

  // Run effect immediately if requested and condition is met
  useEffect(() => {
    if (immediate && condition) {
      run();
    }
  }, [immediate, condition, run, ...deps]);

  return { run, data, error, isLoading, isExecuted };
}
