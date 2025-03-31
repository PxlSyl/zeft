import * as Effect from 'effect/Effect';
/**
 * Type for the store's state
 * @template T The type of the store's state
 */
export type Store<T> = {
  getState: () => T
  setState: (fn: (state: T) => T) => void
  subscribe: (listener: (state: T) => void) => () => void
  setStateSelective: <K extends keyof T>(key: K, value: T[K] | ((prev: T[K]) => T[K])) => void
  getStateSelective: <K extends keyof T>(key: K) => T[K]
}

/**
 * Type for the set function used in store creation
 * @template T The type of the store's state
 */
export type SetState<T> = {
  <K extends keyof T>(
    state: Pick<T, K> | null | ((state: T) => Pick<T, K> | null),
    replace?: boolean
  ): void
  <K extends keyof T>(
    state: ((state: T) => Pick<T, K> | null) | Pick<T, K> | null,
    replace?: boolean
  ): void
  (state: Partial<T> | null | ((state: T) => Partial<T> | null), replace?: boolean): void
}

/**
 * Type for the get function used in store creation
 * @template T The type of the store's state
 */
export type GetState<T> = () => T

/**
 * Type for the store creation function
 * @template T The type of the store's state
 */
export type StateCreator<T> = (
  set: SetState<T>,
  get: GetState<T>
) => T

/**
 * Creates a new store with the given state creator
 * @template T The type of the store's state
 * @param createState Function that creates the initial state
 * @returns A new store instance
 */
export function createStore<T extends object>(
  createState: StateCreator<T>
): Store<T> {
  let state: T
  const subscribers = new Set<(state: T) => void>()

  const setState: SetState<T> = (partial: any, replace = false) => {
    const nextState = typeof partial === 'function' ? partial(state) : partial
    if (nextState !== null) {
      state = replace ? nextState as T : Object.assign({}, state, nextState)
      subscribers.forEach(subscriber => subscriber(state))
    }
  }

  const getState: GetState<T> = () => state

  const subscribe = (listener: (state: T) => void) => {
    subscribers.add(listener)
    return () => subscribers.delete(listener)
  }

  const setStateSelective = <K extends keyof T>(
    key: K, 
    value: T[K] | ((prev: T[K]) => T[K])
  ) => {
    setState((prevState) => {
      const newValue = typeof value === 'function' 
        ? (value as Function)(prevState[key]) 
        : value
      return { ...prevState, [key]: newValue }
    })
  }

  const getStateSelective = <K extends keyof T>(key: K): T[K] => {
    return state[key]
  }

  // Initialize state
  state = createState(setState, getState)

  return {
    getState,
    setState,
    subscribe,
    setStateSelective,
    getStateSelective
  }
}

/**
 * Type for the effect store
 * @template T The type of the store's state
 */
export type EffectStore<T> = Store<T> & {
  run: <A, E>(
    effect: Effect.Effect<A, E, never>,
    options?: {
      onSuccess?: (result: A) => void
      onError?: (error: E) => void
    }
  ) => void
}

/**
 * Creates a new effect store
 * @template T The type of the store's state
 * @param createState Function that creates the initial state
 * @returns A new effect store instance
 */
export function createEffectStore<T extends object>(
  createState: StateCreator<T>
): EffectStore<T> {
  const store = createStore(createState)

  return {
    ...store,
    run: <A, E>(
      effect: Effect.Effect<A, E, never>,
      options?: {
        onSuccess?: (result: A) => void
        onError?: (error: E) => void
      }
    ) => {
      // Cast effect to the expected type for runPromise
      const runPromiseEffect = effect as unknown as Effect.Effect<A, E, never>
      
      Effect.runPromise(runPromiseEffect)
        .then(result => options?.onSuccess?.(result))
        .catch(error => options?.onError?.(error as E))
    }
  }
}