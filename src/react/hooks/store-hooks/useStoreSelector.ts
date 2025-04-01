import { useEffect, useRef, useState } from "react";
import { Store } from "../../../store";

/**
 * Hook to subscribe to a specific part of the store state using a selector
 * @template T The type of the store's state
 * @template U The type of the selected state
 * @param store The store to subscribe to
 * @param selector Function to select the specific part of the state
 * @param equalityFn Optional function to compare selected values for equality
 * @returns The selected part of the state
 */
export function useStoreSelector<T, U>(
  store: Store<T>,
  selector: (state: T) => U,
  equalityFn: (a: U, b: U) => boolean = (a, b) => a === b,
): U {
  const [selected, setSelected] = useState<U>(() => selector(store.getState()));
  const selectorRef = useRef(selector);
  const equalityFnRef = useRef(equalityFn);
  const storeRef = useRef(store);

  useEffect(() => {
    selectorRef.current = selector;
    equalityFnRef.current = equalityFn;
  }, [selector, equalityFn]);

  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  useEffect(() => {
    const subscription = storeRef.current.subscribe((state) => {
      const newSelected = selectorRef.current(state);
      if (!equalityFnRef.current(selected, newSelected)) {
        setSelected(newSelected);
      }
    });

    return () => subscription();
  }, []);

  return selected;
}
