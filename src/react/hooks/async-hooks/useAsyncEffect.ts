import { useCallback, useEffect, useRef, useState } from "react";
import * as Effect from "effect/Effect";

/**
 * Options for useAsyncEffect hook
 * @template A The type of the result value
 * @template E The type of the error
 */
export interface UseAsyncEffectOptions<A, E> {
  /**
   * Called when the effect completes successfully
   */
  onSuccess?: (result: A) => void;

  /**
   * Called when the effect fails
   */
  onError?: (error: E) => void;

  /**
   * Dependencies array for the effect
   */
  deps?: any[];

  /**
   * Whether to run the effect immediately (default: true)
   */
  immediate?: boolean;
}

/**
 * Return type of useAsyncEffect hook
 * @template A The type of the result value
 * @template E The type of the error
 */
export interface UseAsyncEffectResult<A, E> {
  /**
   * Execute the effect manually
   */
  run: () => Promise<void>;

  /**
   * The result of the effect
   */
  data: A | undefined;

  /**
   * The error of the effect, if any
   */
  error: E | undefined;

  /**
   * Whether the effect is currently running
   */
  isLoading: boolean;

  /**
   * Whether the effect has been executed at least once
   */
  isExecuted: boolean;
}

/**
 * Hook to handle asynchronous effects in a more declarative way
 * @template A The type of the result value
 * @template E The type of the error
 * @param effect The Effect to run
 * @param options Options for controlling the effect execution
 * @returns Object containing the run function, data, error, and loading state
 *
 * @example
 * ```tsx
 * // Basic usage
 * const { data, error, isLoading } = useAsyncEffect(
 *   Effect.tryPromise(() => fetch('/api/data').then(r => r.json())),
 *   { immediate: true }
 * );
 *
 * // With manual execution
 * const { run, data, error, isLoading } = useAsyncEffect(
 *   Effect.tryPromise(() => fetch('/api/data').then(r => r.json())),
 *   { immediate: false }
 * );
 *
 * return <button onClick={run} disabled={isLoading}>
 *   {isLoading ? 'Loading...' : 'Fetch Data'}
 * </button>;
 * ```
 */
export function useAsyncEffect<A, E>(
  effect: Effect.Effect<A, E, never>,
  options: UseAsyncEffectOptions<A, E> = {},
): UseAsyncEffectResult<A, E> {
  const { onSuccess, onError, deps = [], immediate = true } = options;

  const [data, setData] = useState<A | undefined>(undefined);
  const [error, setError] = useState<E | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExecuted, setIsExecuted] = useState<boolean>(false);

  const effectRef = useRef(effect);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Update refs when deps change
  useEffect(() => {
    effectRef.current = effect;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [effect, onSuccess, onError, ...deps]);

  const run = useCallback(async () => {
    setIsLoading(true);

    // Create an enhanced effect that handles loading states
    const enhancedEffect = Effect.gen(function* ($) {
      yield* $(
        Effect.sync(() => {
          setIsLoading(true);
          setError(undefined);
        }),
      );

      return yield* $(
        effectRef.current,
        // Handle success with tap
        Effect.tap((result) =>
          Effect.sync(() => {
            setData(result);
            onSuccessRef.current?.(result);
          }),
        ),
        // Handle error with tapError
        Effect.tapError((err) =>
          Effect.sync(() => {
            setError(err);
            onErrorRef.current?.(err);
          }),
        ),
        // Handle both success and error cases
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
  }, []);

  // Run effect immediately if requested
  useEffect(() => {
    if (immediate) {
      run();
    }
  }, [immediate, run, ...deps]);

  return { run, data, error, isLoading, isExecuted };
}
