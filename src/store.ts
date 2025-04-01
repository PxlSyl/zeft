import * as Effect from "effect/Effect";
/**
 * Type for the store's state
 * @template T The type of the store's state
 */
export type Store<T> = {
  getState: () => T;
  setState: (fn: (state: T) => T) => void;
  subscribe: (listener: (state: T) => void) => () => void;
  setStateSelective: <K extends keyof T>(
    key: K,
    value: T[K] | ((prev: T[K]) => T[K]),
  ) => void;
  getStateSelective: <K extends keyof T>(key: K) => T[K];
};

/**
 * Type for the set function used in store creation
 * @template T The type of the store's state
 */
export type SetState<T> = {
  <K extends keyof T>(
    state: Pick<T, K> | null | ((state: T) => Pick<T, K> | null),
    replace?: boolean,
    actionName?: string,
  ): void;
  <K extends keyof T>(
    state: ((state: T) => Pick<T, K> | null) | Pick<T, K> | null,
    replace?: boolean,
    actionName?: string,
  ): void;
  (
    state: Partial<T> | null | ((state: T) => Partial<T> | null),
    replace?: boolean,
    actionName?: string,
  ): void;
};

/**
 * Type for the get function used in store creation
 * @template T The type of the store's state
 */
export type GetState<T> = () => T;

/**
 * Type for the store creation function
 * @template T The type of the store's state
 */
export type StateCreator<T> = (set: SetState<T>, get: GetState<T>) => T;

/**
 * Type for a slice of the store's state
 * @template T The type of the entire store's state
 * @template S The type of the slice
 */
export type StateSlice<T, S> = (set: SetState<T>, get: GetState<T>) => S;

/**
 * Creates a store slice that can be combined with other slices
 * @template T The type of the entire store's state
 * @template S The type of the slice
 * @param fn Function that creates the slice
 * @returns A slice that can be combined with other slices
 *
 * @example
 * ```typescript
 * // userSlice.ts
 * interface UserSlice {
 *   user: User | null;
 *   setUser: (user: User | null) => void;
 * }
 *
 * export const createUserSlice = <T>() =>
 *   createSlice<T, UserSlice>((set, get) => ({
 *     user: null,
 *     setUser: (user) => set({ user } as any)
 *   }));
 *
 * // store.ts
 * const useStore = createStore((...a) => ({
 *   ...createUserSlice<StoreState>()(...a),
 *   ...createTodosSlice<StoreState>()(...a)
 * }));
 * ```
 */
export function createSlice<T, S>(fn: StateSlice<T, S>): StateSlice<T, S> {
  return fn;
}

/**
 * Combines multiple slices into a single state creator
 * @template T The type of the store's state
 * @param slices Object containing state slices to combine
 * @returns A combined state creator function
 *
 * @example
 * ```typescript
 * // Define state type that includes all slices
 * type StoreState = UserSlice & TodosSlice & SettingsSlice;
 *
 * // Create the store with combined slices
 * const useStore = createStore<StoreState>(
 *   combineSlices({
 *     // Each slice automatically receives the correct typing
 *     ...createUserSlice<StoreState>(),
 *     ...createTodosSlice<StoreState>(),
 *     ...createSettingsSlice<StoreState>()
 *   })
 * );
 * ```
 */
export function combineSlices<T>(
  slices: Record<string, StateSlice<T, any>>,
): StateCreator<T> {
  return (set, get) => {
    const createState: Record<string, any> = {};

    for (const key in slices) {
      const slice = slices[key];
      Object.assign(createState, slice(set, get));
    }

    return createState as T;
  };
}

/**
 * Creates a new store with the given state creator
 * @template T The type of the store's state
 * @param createState Function that creates the initial state
 * @returns A new store instance
 */
export function createStore<T extends object>(
  createState: StateCreator<T>,
): Store<T> {
  let state: T;
  const subscribers = new Set<(state: T) => void>();

  const setState: SetState<T> = (partial: any, replace = false) => {
    const nextState = typeof partial === "function" ? partial(state) : partial;
    if (nextState !== null) {
      state = replace ? (nextState as T) : Object.assign({}, state, nextState);
      subscribers.forEach((subscriber) => subscriber(state));
    }
  };

  const getState: GetState<T> = () => state;

  const subscribe = (listener: (state: T) => void) => {
    subscribers.add(listener);
    return () => subscribers.delete(listener);
  };

  const setStateSelective = <K extends keyof T>(
    key: K,
    value: T[K] | ((prev: T[K]) => T[K]),
  ) => {
    setState((prevState) => {
      const newValue =
        typeof value === "function"
          ? (value as Function)(prevState[key])
          : value;
      return { ...prevState, [key]: newValue };
    });
  };

  const getStateSelective = <K extends keyof T>(key: K): T[K] => {
    return state[key];
  };

  // Initialize state
  state = createState(setState, getState);

  return {
    getState,
    setState,
    subscribe,
    setStateSelective,
    getStateSelective,
  };
}

/**
 * Type for the effect store
 * @template T The type of the store's state
 */
export type EffectStore<T> = Store<T> & {
  run: <A, E>(
    effect: Effect.Effect<A, E, never>,
    options?: {
      onSuccess?: (result: A) => void;
      onError?: (error: E) => void;
    },
  ) => void;
};

/**
 * Creates a new effect store
 * @template T The type of the store's state
 * @param createState Function that creates the initial state
 * @returns A new effect store instance
 */
export function createEffectStore<T extends object>(
  createState: StateCreator<T>,
): EffectStore<T> {
  const store = createStore(createState);

  return {
    ...store,
    run: <A, E>(
      effect: Effect.Effect<A, E, never>,
      options?: {
        onSuccess?: (result: A) => void;
        onError?: (error: E) => void;
      },
    ) => {
      // Cast effect to the expected type for runPromise
      const runPromiseEffect = effect as unknown as Effect.Effect<A, E, never>;

      Effect.runPromise(runPromiseEffect)
        .then((result) => options?.onSuccess?.(result))
        .catch((error) => options?.onError?.(error as E));
    },
  };
}
