import { useEffect, useRef, useState, useCallback } from "react"
import { Store, EffectStore } from "../store"
import * as Effect from 'effect/Effect'

/**
 * Hook to subscribe to a store and get its current state
 * @template T The type of the store's state
 * @param store The store to subscribe to
 * @returns The current state of the store
 */
export function useStore<T>(store: Store<T>): T {
  const [state, setState] = useState<T>(store.getState())
  const storeRef = useRef(store)

  useEffect(() => {
    storeRef.current = store
  }, [store])

  useEffect(() => {
    const subscription = storeRef.current.subscribe((newState) => {
      setState(newState)
    })

    return () => subscription()
  }, [])

  return state
}

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
  equalityFn: (a: U, b: U) => boolean = (a, b) => a === b
): U {
  const [selected, setSelected] = useState<U>(() => selector(store.getState()))
  const selectorRef = useRef(selector)
  const equalityFnRef = useRef(equalityFn)
  const storeRef = useRef(store)

  useEffect(() => {
    selectorRef.current = selector
    equalityFnRef.current = equalityFn
  }, [selector, equalityFn])

  useEffect(() => {
    storeRef.current = store
  }, [store])

  useEffect(() => {
    const subscription = storeRef.current.subscribe((state) => {
      const newSelected = selectorRef.current(state)
      if (!equalityFnRef.current(selected, newSelected)) {
        setSelected(newSelected)
      }
    })

    return () => subscription()
  }, [])

  return selected
}

/**
 * Hook to use an EffectStore with React
 * @template T The type of the store's state
 * @param store The EffectStore to use
 * @returns Tuple containing the current state and a function to run effects
 */
export function useEffectStore<T>(store: EffectStore<T>) {
  const state = useStore(store)
  const storeRef = useRef(store)

  useEffect(() => {
    storeRef.current = store
  }, [store])

  const runEffect = useCallback(<A, E>(
    effect: Effect.Effect<A, E, never>,
    options?: {
      onSuccess?: (result: A) => void
      onError?: (error: E) => void
    }
  ) => storeRef.current.run(effect, options), [])

  return [state, runEffect] as const
}

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
  deps: any[] = []
): (state: T) => U {
  const selectorRef = useRef(selector)

  useEffect(() => {
    selectorRef.current = selector
  }, [selector, ...deps])

  return useCallback((state: T) => selectorRef.current(state), [])
}

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
  deps: any[] = []
): A {
  const actionRef = useRef(action)

  useEffect(() => {
    actionRef.current = action
  }, [action, ...deps])

  return useCallback((...args: Parameters<A>) => actionRef.current(...args), []) as A
} 