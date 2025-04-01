import { useCallback, useEffect, useRef, useState } from "react";
import * as Effect from "effect/Effect";
import { EffectStore } from "../../../store";
import { UseAsyncEffectOptions, UseAsyncEffectResult } from "./useAsyncEffect";

/**
 * Hook to use an effect with a store
 * @template A The type of the result value
 * @template E The type of the error
 * @template T The type of the store's state
 * @param store The EffectStore to use
 * @param effect The Effect to run
 * @param options Options for controlling the effect execution
 * @returns Object containing the run function, data, error, and loading state
 *
 * @example
 * ```tsx
 * // Basic usage with a store
 * const { data, error, isLoading } = useStoreEffect(
 *   todoStore,
 *   fetchTodosEffect,
 *   {
 *     onSuccess: (todos) => todoStore.setState({ todos, loading: false }),
 *     onError: (error) => todoStore.setState({ error, loading: false })
 *   }
 * );
 * ```
 */
export function useStoreEffect<A, E, T>(
  store: EffectStore<T>,
  effect: Effect.Effect<A, E, never>,
  options: UseAsyncEffectOptions<A, E> = {},
): UseAsyncEffectResult<A, E> {
  const storeRef = useRef(store);

  // State for the hook
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuted, setIsExecuted] = useState(false);
  const [data, setData] = useState<A | undefined>(undefined);
  const [error, setError] = useState<E | undefined>(undefined);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  // Use the store's run method with Effect
  const run = useCallback(async () => {
    // Create an effect for handling the store's state management
    const storeEffect = Effect.gen(function* ($) {
      yield* $(
        Effect.sync(() => {
          setIsLoading(true);
          setError(undefined);
        }),
      );

      return yield* $(
        Effect.async<A, E, never>((resume) => {
          storeRef.current.run(effect, {
            onSuccess: (result) => {
              setData(result);
              options.onSuccess?.(result);
              setIsLoading(false);
              setIsExecuted(true);
              resume(Effect.succeed(result));
            },
            onError: (err) => {
              setError(err);
              options.onError?.(err);
              setIsLoading(false);
              setIsExecuted(true);
              resume(Effect.fail(err));
            },
          });
        }),
      );
    });

    // Run the effect
    await Effect.runPromise(
      Effect.catchAll(storeEffect, () => Effect.succeed(undefined)),
    );
  }, [effect, options.onSuccess, options.onError]);

  // Run effect immediately if requested
  useEffect(() => {
    if (options.immediate) {
      run();
    }
  }, [options.immediate, run, ...(options.deps || [])]);

  return { run, data, error, isLoading, isExecuted };
}
