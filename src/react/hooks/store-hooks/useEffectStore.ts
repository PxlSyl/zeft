import { useEffect, useRef, useCallback } from "react";
import { EffectStore } from "../../../store";
import * as Effect from "effect/Effect";
import { useStore } from "./useStore";

/**
 * Hook to use an EffectStore with React
 * @template T The type of the store's state
 * @param store The EffectStore to use
 * @returns Tuple containing the current state and a function to run effects
 */
export function useEffectStore<T>(store: EffectStore<T>) {
  const state = useStore(store);
  const storeRef = useRef(store);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  const runEffect = useCallback(
    <A, E>(
      effect: Effect.Effect<A, E, never>,
      options?: {
        onSuccess?: (result: A) => void;
        onError?: (error: E) => void;
      },
    ) => storeRef.current.run(effect, options),
    [],
  );

  return [state, runEffect] as const;
}
