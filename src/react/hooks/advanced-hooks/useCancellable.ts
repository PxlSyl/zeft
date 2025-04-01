import { useCallback, useEffect, useRef, useState } from "react";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Duration from "effect/Duration";

/**
 * Custom error class for timeouts
 */
export class TimeoutError extends Error {
  constructor(message: string = "Operation timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Options for useCancellable hook
 */
export interface UseCancellableOptions<A, E> {
  /**
   * Timeout in milliseconds for the effect
   */
  timeout?: number;

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
 * Result of useCancellable hook
 */
export interface UseCancellableResult<A, E> {
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
   * Function to manually run the effect
   */
  run: () => void;

  /**
   * Function to cancel the running effect
   */
  cancel: () => void;
}

/**
 * Hook to manage cancellation and timeout for effects
 * @template A The type of the result value
 * @template E The type of the error
 * @param effect The Effect to run
 * @param options Options for controlling the effect execution
 * @returns Object containing state and functions to control the effect
 */
export function useCancellable<A, E>(
  effect: Effect.Effect<A, E, never>,
  options: UseCancellableOptions<A, E> = {},
): UseCancellableResult<A, E> {
  const { timeout, immediate = true, onSuccess, onError, deps = [] } = options;

  // State
  const [data, setData] = useState<A | undefined>(undefined);
  const [error, setError] = useState<E | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Refs for the effect and fiber
  const effectRef = useRef(effect);
  const fiberRef = useRef<Fiber.RuntimeFiber<A, E> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const timeoutRef = useRef(timeout);

  // Update refs when dependencies change
  useEffect(() => {
    effectRef.current = effect;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
    timeoutRef.current = timeout;
  }, [effect, onSuccess, onError, timeout, ...deps]);

  // Cleanup function on unmount
  useEffect(() => {
    return () => {
      if (fiberRef.current) {
        Effect.runPromise(Fiber.interrupt(fiberRef.current)).catch(() => {});
      }
    };
  }, []);

  // Function to cancel the effect
  const cancel = useCallback(() => {
    if (fiberRef.current) {
      Effect.runPromise(Fiber.interrupt(fiberRef.current)).catch(() => {});
      fiberRef.current = null;
      setIsLoading(false);
    }
  }, []);

  // Function to run the effect
  const run = useCallback(() => {
    // Cancel any previous operation
    if (fiberRef.current) {
      Effect.runPromise(Fiber.interrupt(fiberRef.current)).catch(() => {});
      fiberRef.current = null;
    }

    // Reset states
    setData(undefined);
    setError(undefined);
    setIsLoading(true);

    // Apply timeout if specified
    let effectToRun = effectRef.current;

    if (timeoutRef.current && timeoutRef.current > 0) {
      effectToRun = Effect.timeout(
        effectToRun,
        Duration.millis(timeoutRef.current),
      ).pipe(
        Effect.catchTag("TimeoutException", () =>
          Effect.fail(new TimeoutError("Operation timed out") as unknown as E),
        ),
      );
    }

    // Fork the effect to get a fiber
    const fiber = Effect.runFork(effectToRun);
    fiberRef.current = fiber;

    // Monitor the fiber completion
    Effect.runPromise(
      Effect.flatMap(Fiber.join(fiber), (result) =>
        Effect.sync(() => {
          setIsLoading(false);
          setData(result);
          if (onSuccessRef.current) {
            onSuccessRef.current(result);
          }
          fiberRef.current = null;
          return result;
        }),
      ),
    ).catch((err) => {
      setIsLoading(false);

      // Check if it's a simple value or an Exit object
      if (err && typeof err === "object" && "_tag" in err) {
        // Handle Exit interruption
        if (
          err._tag === "Failure" &&
          err.cause &&
          err.cause._tag === "Interrupt"
        ) {
          // This was an interruption, just clear the state
          fiberRef.current = null;
          return;
        }
      }

      // Regular error
      setError(err as E);
      if (onErrorRef.current) {
        onErrorRef.current(err as E);
      }
      fiberRef.current = null;
    });
  }, []);

  // Run effect immediately if specified
  useEffect(() => {
    if (immediate) {
      run();
    }
  }, [immediate, run, ...deps]);

  return {
    data,
    error,
    isLoading,
    run,
    cancel,
  };
}
