import { useCallback, useEffect, useRef, useState } from "react";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Schedule from "effect/Schedule";
import * as Duration from "effect/Duration";
import { pipe } from "effect/Function";

/**
 * Options for useRetry hook
 */
export interface UseRetryOptions<A, E> {
  /**
   * Maximum number of retries
   */
  maxRetries?: number;

  /**
   * Base delay between retries in milliseconds
   */
  baseDelay?: number;

  /**
   * Strategy for backoff: exponential, linear, or constant
   */
  retryStrategy?: "exponential" | "linear" | "constant";

  /**
   * Whether to run the effect immediately on mount
   */
  immediate?: boolean;

  /**
   * Callback called when the effect succeeds
   */
  onSuccess?: (data: A) => void;

  /**
   * Callback called when the effect fails
   */
  onError?: (error: E) => void;

  /**
   * Dependencies array for the effect
   */
  deps?: any[];
}

/**
 * Result of useRetry hook
 */
export interface UseRetryResult<A, E> {
  /**
   * The result data, if available
   */
  data: A | undefined;

  /**
   * The error, if any
   */
  error: E | undefined;

  /**
   * Whether the effect is currently running
   */
  isLoading: boolean;

  /**
   * The current retry count
   */
  retryCount: number;

  /**
   * Function to manually run the effect
   */
  run: () => void;

  /**
   * Function to retry after an error
   */
  retry: () => void;
}

/**
 * Hook to automatically retry failed effects with configurable backoff
 * @template A The type of the result value
 * @template E The type of the error
 * @param effect The Effect to run
 * @param options Options for controlling the retries
 * @returns Object containing state and functions to control the effect
 */
export function useRetry<A, E>(
  effect: Effect.Effect<A, E, never>,
  options: UseRetryOptions<A, E> = {},
): UseRetryResult<A, E> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    retryStrategy = "exponential",
    immediate = true,
    onSuccess,
    onError,
    deps = [],
  } = options;

  const [data, setData] = useState<A | undefined>(undefined);
  const [error, setError] = useState<E | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);

  // Refs to store callbacks and options
  const effectRef = useRef(effect);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const maxRetriesRef = useRef(maxRetries);
  const baseDelayRef = useRef(baseDelay);
  const retryStrategyRef = useRef(retryStrategy);
  const fiberRef = useRef<Fiber.RuntimeFiber<A, E> | null>(null);

  // Update refs when dependencies change
  useEffect(() => {
    effectRef.current = effect;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
    maxRetriesRef.current = maxRetries;
    baseDelayRef.current = baseDelay;
    retryStrategyRef.current = retryStrategy;
  }, [
    effect,
    onSuccess,
    onError,
    maxRetries,
    baseDelay,
    retryStrategy,
    ...deps,
  ]);

  // Cleanup function to abort any ongoing effect
  useEffect(() => {
    return () => {
      if (fiberRef.current) {
        Effect.runPromise(Fiber.interrupt(fiberRef.current)).catch(() => {});
        fiberRef.current = null;
      }
    };
  }, []);

  // Create a retry schedule based on the strategy
  const createRetrySchedule = useCallback(() => {
    const baseMs = baseDelayRef.current;
    const strategy = retryStrategyRef.current;
    const maxAttempts = maxRetriesRef.current;

    // Create base schedule using functional approach
    const baseSchedule = (() => {
      const duration = Duration.millis(baseMs);
      return strategy === "exponential"
        ? Schedule.exponential(duration)
        : strategy === "linear"
          ? Schedule.spaced(duration)
          : Schedule.fixed(duration);
    })();

    // Compose with attempt limits and retry count updates
    return pipe(
      baseSchedule,
      Schedule.compose(Schedule.recurs(maxAttempts)),
      Schedule.onDecision((_, decision) => {
        // Continue decision means a new retry will happen
        if (decision._tag === "Continue") {
          // Update UI with the retry count
          // Since we're using 'recurs', the number of attempts is already tracked
          const attemptNumber = maxAttempts - (decision as any).intervals + 1;
          setRetryCount(attemptNumber);

          // Call the error callback if defined
          if (error && onErrorRef.current) {
            onErrorRef.current(error);
          }
        }

        return Effect.unit;
      }),
    );
  }, [error]);

  // Function to execute the effect with retries
  const executeWithRetries = useCallback(async () => {
    // Reset states
    setData(undefined);
    setError(undefined);
    setIsLoading(true);
    setRetryCount(0);

    // Cancel any previous operation
    if (fiberRef.current) {
      await Effect.runPromise(Fiber.interrupt(fiberRef.current)).catch(
        () => {},
      );
      fiberRef.current = null;
    }

    // Create the retry schedule
    const retrySchedule = createRetrySchedule();

    // Apply the schedule to the effect to add retry logic
    const effectWithRetry = pipe(
      effectRef.current,
      Effect.retry(retrySchedule),
    );

    // Fork the effect to get a fiber
    const fiber = Effect.runFork(effectWithRetry);
    fiberRef.current = fiber;

    // Use Effect's functional approach for handling success and failure
    await Effect.runPromise(
      pipe(
        Fiber.join(fiber),
        Effect.match({
          onSuccess: (result) =>
            Effect.sync(() => {
              // Success - update state
              setData(result);
              setIsLoading(false);

              if (onSuccessRef.current) {
                onSuccessRef.current(result);
              }

              fiberRef.current = null;
            }),
          onFailure: (err) =>
            Effect.sync(() => {
              // Final error after all retry attempts
              setError(err as E);
              setIsLoading(false);

              if (onErrorRef.current) {
                onErrorRef.current(err as E);
              }

              fiberRef.current = null;
            }),
        }),
      ),
    );
  }, [createRetrySchedule]);

  // Function to run the effect (exposed to the user)
  const run = useCallback(() => {
    executeWithRetries();
  }, [executeWithRetries]);

  // Function to retry after an error (exposed to the user)
  const retry = useCallback(() => {
    // Reset retry count
    setRetryCount(0);
    setError(undefined);

    // Run the effect again
    executeWithRetries();
  }, [executeWithRetries]);

  // Run effect immediately if specified
  useEffect(() => {
    if (immediate) {
      executeWithRetries();
    }
  }, [immediate, executeWithRetries]);

  return {
    data,
    error,
    isLoading,
    retryCount,
    run,
    retry,
  };
}
