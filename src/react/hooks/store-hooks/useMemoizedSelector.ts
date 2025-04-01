import { useEffect, useRef, useCallback } from "react";

/**
 * Hook to create a memoized selector
 * @template T The type of the store's state
 * @template U The type of the selected state
 * @param selector The selector function to memoize
 * @param deps Dependencies for the selector
 * @returns A memoized selector function
 */
export function useMemoizedSelector<T, U>(
  selector: (state: T) => U,
  deps: any[] = [],
): (state: T) => U {
  const selectorRef = useRef(selector);

  useEffect(() => {
    selectorRef.current = selector;
  }, [selector, ...deps]);

  return useCallback((state: T) => selectorRef.current(state), []);
}
