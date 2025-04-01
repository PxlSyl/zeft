import { useEffect, useRef, useState } from "react";
import { Store } from "../../../store";

/**
 * Hook to subscribe to a store and get its current state
 * @template T The type of the store's state
 * @param store The store to subscribe to
 * @returns The current state of the store
 */
export function useStore<T>(store: Store<T>): T {
  const [state, setState] = useState<T>(store.getState());
  const storeRef = useRef(store);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  useEffect(() => {
    const subscription = storeRef.current.subscribe((newState) => {
      setState(newState);
    });

    return () => subscription();
  }, []);

  return state;
}
