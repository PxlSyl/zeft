import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";

/**
 * Options for useReducerWithEffect hook
 */
export interface UseReducerWithEffectOptions<S, A, E> {
  /**
   * Initial state for the reducer
   */
  initialState: S;

  /**
   * Function to determine if an effect should run after a state change
   */
  shouldRunEffect?: (state: S, action: A) => boolean;

  /**
   * Function to create an effect from the current state and action
   */
  effectFactory?: (state: S, action: A) => Effect.Effect<void, E, never> | null;

  /**
   * Callback called when an effect succeeds
   */
  onEffectSuccess?: (state: S, action: A) => void;

  /**
   * Callback called when an effect fails
   */
  onEffectError?: (error: E, state: S, action: A) => void;
}

/**
 * Special action type that can trigger an effect
 */
export interface ReducerEffectAction<T> {
  type: string;
  payload: T;
  runEffect?: boolean;
}

/**
 * Result of useReducerWithEffect hook
 */
export interface UseReducerWithEffectResult<S, A, E> {
  /**
   * Current state
   */
  state: S;

  /**
   * Dispatch function to update state
   */
  dispatch: (action: A) => void;

  /**
   * Whether an effect is currently running
   */
  isEffectRunning: boolean;

  /**
   * The latest effect error, if any
   */
  effectError: E | undefined;

  /**
   * Function to cancel any running effect
   */
  cancelEffect: () => void;
}

/**
 * Hook that combines useReducer with Effect capabilities
 * @template S The state type
 * @template A The action type
 * @template E The effect error type
 * @param reducer The reducer function
 * @param options Configuration options
 * @returns Object containing state and functions to control the reducer and effects
 */
export function useReducerWithEffect<S, A extends ReducerEffectAction<any>, E>(
  reducer: (state: S, action: A) => S,
  options: UseReducerWithEffectOptions<S, A, E>,
): UseReducerWithEffectResult<S, A, E> {
  const {
    initialState,
    shouldRunEffect = (_, action) => !!action.runEffect,
    effectFactory,
    onEffectSuccess,
    onEffectError,
  } = options;

  // State
  const [state, baseDispatch] = useReducer(reducer, initialState);
  const [isEffectRunning, setIsEffectRunning] = useState<boolean>(false);
  const [effectError, setEffectError] = useState<E | undefined>(undefined);

  // Refs
  const stateRef = useRef(state);
  const effectFactoryRef = useRef(effectFactory);
  const shouldRunEffectRef = useRef(shouldRunEffect);
  const onEffectSuccessRef = useRef(onEffectSuccess);
  const onEffectErrorRef = useRef(onEffectError);
  const fiberRef = useRef<Fiber.RuntimeFiber<void, E> | null>(null);
  const lastActionRef = useRef<A | null>(null);

  // Update refs when dependencies change
  useEffect(() => {
    stateRef.current = state;
    effectFactoryRef.current = effectFactory;
    shouldRunEffectRef.current = shouldRunEffect;
    onEffectSuccessRef.current = onEffectSuccess;
    onEffectErrorRef.current = onEffectError;
  }, [state, effectFactory, shouldRunEffect, onEffectSuccess, onEffectError]);

  // Cleanup function
  useEffect(() => {
    return () => {
      if (fiberRef.current) {
        Effect.runPromise(Fiber.interrupt(fiberRef.current)).catch(() => {});
      }
    };
  }, []);

  // Function to cancel the effect
  const cancelEffect = useCallback(() => {
    if (fiberRef.current) {
      Effect.runPromise(Fiber.interrupt(fiberRef.current)).catch(() => {});
      fiberRef.current = null;
      setIsEffectRunning(false);
    }
  }, []);

  // Enhanced dispatch function
  const dispatch = useCallback(
    (action: A) => {
      // First update the state
      baseDispatch(action);

      // Save the action for effect handlers
      lastActionRef.current = action;

      // Check if we should run an effect
      if (
        shouldRunEffectRef.current &&
        effectFactoryRef.current &&
        shouldRunEffectRef.current(stateRef.current, action)
      ) {
        // Cancel any previous effect
        if (fiberRef.current) {
          Effect.runPromise(Fiber.interrupt(fiberRef.current)).catch(() => {});
        }

        // Reset error state
        setEffectError(undefined);

        // Create the effect
        const effect = effectFactoryRef.current(stateRef.current, action);

        if (effect) {
          // Start running the effect
          setIsEffectRunning(true);

          // Fork the effect to get a fiber
          const fiber = Effect.runFork(effect);
          fiberRef.current = fiber;

          // Monitor the fiber completion
          Effect.runPromise(Fiber.join(fiber))
            .then(() => {
              setIsEffectRunning(false);

              if (onEffectSuccessRef.current && lastActionRef.current) {
                onEffectSuccessRef.current(
                  stateRef.current,
                  lastActionRef.current,
                );
              }

              fiberRef.current = null;
            })
            .catch((err) => {
              setIsEffectRunning(false);
              setEffectError(err as E);

              if (onEffectErrorRef.current && lastActionRef.current) {
                onEffectErrorRef.current(
                  err as E,
                  stateRef.current,
                  lastActionRef.current,
                );
              }

              fiberRef.current = null;
            });
        }
      }
    },
    [baseDispatch],
  );

  return {
    state,
    dispatch,
    isEffectRunning,
    effectError,
    cancelEffect,
  };
}
