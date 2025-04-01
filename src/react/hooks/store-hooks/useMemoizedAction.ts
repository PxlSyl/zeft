import { useEffect, useRef, useCallback } from "react";

/**
 * Hook to create a memoized action creator
 * @template T The type of the store's state
 * @template A The type of the action creator function
 * @param action The action creator function
 * @param deps Dependencies for the action creator
 * @returns A memoized action creator function
 */
export function useMemoizedAction<T, A extends (...args: any[]) => any>(
  action: A,
  deps: any[] = [],
): A {
  const actionRef = useRef(action);

  useEffect(() => {
    actionRef.current = action;
  }, [action, ...deps]);

  return useCallback(
    (...args: Parameters<A>) => actionRef.current(...args),
    [],
  ) as A;
}
