import { useCallback, useEffect, useRef, useState } from "react";
import * as Effect from "effect/Effect";

/**
 * Represents a combined effect execution order
 */
export type EffectExecutionOrder = "parallel" | "sequence";

/**
 * Options for useCombinedEffects hook
 * @template T The type of the results tuple
 * @template E The type of the error
 */
export interface UseCombinedEffectsOptions<T extends unknown[], E> {
  /**
   * How to execute the effects (default: 'parallel')
   */
  executionOrder?: EffectExecutionOrder;

  /**
   * Called when all effects complete successfully
   */
  onSuccess?: (results: T) => void;

  /**
   * Called when any of the effects fail
   */
  onError?: (error: E) => void;

  /**
   * Dependencies array for the effects
   */
  deps?: any[];

  /**
   * Whether to run the effects immediately (default: true)
   */
  immediate?: boolean;
}

/**
 * Return type of useCombinedEffects hook
 * @template T The type of the results tuple
 * @template E The type of the error
 */
export interface UseCombinedEffectsResult<T extends unknown[], E> {
  /**
   * Execute the effects manually
   */
  run: () => Promise<void>;

  /**
   * The results of the effects
   */
  data: T | undefined;

  /**
   * The error of the effects, if any
   */
  error: E | undefined;

  /**
   * Whether the effects are currently running
   */
  isLoading: boolean;

  /**
   * Whether the effects have been executed at least once
   */
  isExecuted: boolean;
}

/**
 * Hook to combine multiple effects and execute them in sequence or in parallel
 * @template A The type of the results array element
 * @template E The type of the error
 * @param effects Array of Effects to run
 * @param options Options for controlling the effects execution
 * @returns Object containing the run function, data, error, and loading state
 *
 * @example
 * ```tsx
 * // Execute effects in parallel (default)
 * const { data, error, isLoading } = useCombinedEffects(
 *   [fetchUsers, fetchPosts, fetchComments],
 *   { executionOrder: 'parallel' }
 * );
 *
 * // Execute effects in sequence
 * const { data, error, isLoading } = useCombinedEffects(
 *   [loginEffect, fetchUserDataEffect, fetchUserPreferencesEffect],
 *   { executionOrder: 'sequence' }
 * );
 * ```
 */
export function useCombinedEffects<A, E>(
  effects: Effect.Effect<A, E, never>[],
  options: UseCombinedEffectsOptions<A[], E> = {},
): UseCombinedEffectsResult<A[], E> {
  const {
    executionOrder = "parallel",
    onSuccess,
    onError,
    deps = [],
    immediate = true,
  } = options;

  const [data, setData] = useState<A[] | undefined>(undefined);
  const [error, setError] = useState<E | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExecuted, setIsExecuted] = useState<boolean>(false);

  const effectsRef = useRef(effects);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Update refs when deps change
  useEffect(() => {
    effectsRef.current = effects;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [effects, onSuccess, onError, ...deps]);

  const run = useCallback(async () => {
    setIsLoading(true);

    // Define effects to run based on execution order
    const baseEffect =
      executionOrder === "sequence"
        ? Effect.gen(function* ($) {
            const results: A[] = [];
            for (const effect of effectsRef.current) {
              results.push(yield* $(effect));
            }
            return results;
          })
        : Effect.all(effectsRef.current, { concurrency: "unbounded" });

    // Enhance the effect with proper state management
    const enhancedEffect = Effect.gen(function* ($) {
      yield* $(
        Effect.sync(() => {
          setIsLoading(true);
          setError(undefined);
        }),
      );

      return yield* $(
        baseEffect,
        // Handle success
        Effect.tap((results) =>
          Effect.sync(() => {
            setData(results);
            onSuccessRef.current?.(results);
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
      Effect.catchAll(enhancedEffect, () => Effect.succeed(undefined)),
    );
  }, [executionOrder]);

  // Run effects immediately if requested
  useEffect(() => {
    if (immediate) {
      run();
    }
  }, [immediate, run, ...deps]);

  return { run, data, error, isLoading, isExecuted };
}
