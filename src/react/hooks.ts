import { useCallback, useEffect, useRef, useState } from "react";
import * as Effect from "effect/Effect";
import { EffectStore } from "../store";

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
  options: UseAsyncEffectOptions<A, E> = {}
): UseAsyncEffectResult<A, E> {
  const { 
    onSuccess, 
    onError, 
    deps = [], 
    immediate = true 
  } = options;
  
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
    const enhancedEffect = Effect.gen(function*($) {
      yield* $(Effect.sync(() => {
        setIsLoading(true);
        setError(undefined);
      }));

      return yield* $(
        effectRef.current,
        // Handle success with tap
        Effect.tap((result) => Effect.sync(() => {
          setData(result);
          onSuccessRef.current?.(result);
        })),
        // Handle error with tapError
        Effect.tapError((err) => Effect.sync(() => {
          setError(err);
          onErrorRef.current?.(err);
        })),
        // Handle both success and error cases
        Effect.ensuring(
          Effect.sync(() => {
            setIsLoading(false);
            setIsExecuted(true);
          })
        )
      );
    });
    
    // Run the effect
    await Effect.runPromise(Effect.catchAll(enhancedEffect, () => Effect.succeed(undefined)));
  }, []);
  
  // Run effect immediately if requested
  useEffect(() => {
    if (immediate) {
      run();
    }
  }, [immediate, run, ...deps]);
  
  return { run, data, error, isLoading, isExecuted };
}

/**
 * Represents a combined effect execution order
 */
export type EffectExecutionOrder = 'parallel' | 'sequence';

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
  options: UseCombinedEffectsOptions<A[], E> = {}
): UseCombinedEffectsResult<A[], E> {
  const { 
    executionOrder = 'parallel', 
    onSuccess, 
    onError, 
    deps = [], 
    immediate = true 
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
    const baseEffect = executionOrder === 'sequence'
      ? Effect.gen(function*($) {
          const results: A[] = [];
          for (const effect of effectsRef.current) {
            results.push(yield* $(effect));
          }
          return results;
        })
      : Effect.all(effectsRef.current, { concurrency: "unbounded" });
    
    // Enhance the effect with proper state management
    const enhancedEffect = Effect.gen(function*($) {
      yield* $(Effect.sync(() => {
        setIsLoading(true);
        setError(undefined);
      }));

      return yield* $(
        baseEffect,
        // Handle success
        Effect.tap((results) => Effect.sync(() => {
          setData(results);
          onSuccessRef.current?.(results);
        })),
        // Handle error
        Effect.tapError((err) => Effect.sync(() => {
          setError(err);
          onErrorRef.current?.(err);
        })),
        // Handle cleanup
        Effect.ensuring(
          Effect.sync(() => {
            setIsLoading(false);
            setIsExecuted(true);
          })
        )
      );
    });
    
    // Run the effect
    await Effect.runPromise(Effect.catchAll(enhancedEffect, () => Effect.succeed(undefined)));
  }, [executionOrder]);
  
  // Run effects immediately if requested
  useEffect(() => {
    if (immediate) {
      run();
    }
  }, [immediate, run, ...deps]);
  
  return { run, data, error, isLoading, isExecuted };
}

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
  options: UseAsyncEffectOptions<A, E> = {}
): UseAsyncEffectResult<A, E> {
  const { 
    onSuccess, 
    onError, 
    deps = [], 
    immediate = true 
  } = options;
  
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
    const conditionalEffect = Effect.gen(function*($) {
      // Skip if condition not met
      if (!conditionRef.current) {
        return yield* $(Effect.succeed(undefined));
      }
      
      yield* $(Effect.sync(() => {
        setIsLoading(true);
        setError(undefined);
      }));

      return yield* $(
        effectRef.current,
        // Handle success
        Effect.tap((result) => Effect.sync(() => {
          setData(result);
          onSuccessRef.current?.(result);
        })),
        // Handle error
        Effect.tapError((err) => Effect.sync(() => {
          setError(err);
          onErrorRef.current?.(err);
        })),
        // Handle cleanup
        Effect.ensuring(
          Effect.sync(() => {
            setIsLoading(false);
            setIsExecuted(true);
          })
        )
      );
    });
    
    // Run the effect
    await Effect.runPromise(Effect.catchAll(conditionalEffect, () => Effect.succeed(undefined)));
  }, []);
  
  // Run effect immediately if requested and condition is met
  useEffect(() => {
    if (immediate && condition) {
      run();
    }
  }, [immediate, condition, run, ...deps]);
  
  return { run, data, error, isLoading, isExecuted };
}

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
  options: UseAsyncEffectOptions<A, E> = {}
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
    const storeEffect = Effect.gen(function*($) {
      yield* $(Effect.sync(() => {
        setIsLoading(true);
        setError(undefined);
      }));
      
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
        })
      );
    });
    
    // Run the effect
    await Effect.runPromise(Effect.catchAll(storeEffect, () => Effect.succeed(undefined)));
  }, [effect, options.onSuccess, options.onError]);
  
  // Run effect immediately if requested
  useEffect(() => {
    if (options.immediate) {
      run();
    }
  }, [options.immediate, run, ...(options.deps || [])]);
  
  return { run, data, error, isLoading, isExecuted };
} 