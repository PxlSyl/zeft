import { StateCreator, Store, SetState, GetState } from "../store";
import * as Effect from "effect/Effect";

/**
 * Interface for the storage system used to persist state
 *
 * This interface represents the basic methods needed to interact with a storage system,
 * such as localStorage, sessionStorage, AsyncStorage (React Native), or a custom storage.
 * It supports both synchronous and asynchronous storage implementations.
 */
export interface StateStorage {
  /**
   * Retrieves an item from storage by name
   * @param name - Key to retrieve from storage
   * @returns The stored value or null if not found, can be a Promise for async storage
   */
  getItem: (name: string) => string | null | Promise<string | null>;

  /**
   * Stores an item in storage
   * @param name - Key to store the value under
   * @param value - String value to store
   * @returns Optional Promise for async operations
   */
  setItem: (name: string, value: string) => void | Promise<void>;

  /**
   * Removes an item from storage
   * @param name - Key to remove from storage
   * @returns Optional Promise for async operations
   */
  removeItem: (name: string) => void | Promise<void>;
}

/**
 * Configuration options for the persist middleware
 *
 * @template T Type of the state object to be persisted
 */
export interface PersistOptions<T> {
  /**
   * Name of the item in storage (must be unique)
   * This name will be used as the key in your storage system
   */
  name: string;

  /**
   * Storage system to use (default: localStorage)
   * You can provide any storage system that implements the StateStorage interface
   */
  storage?: StateStorage;

  /**
   * Function to filter which parts of the state to persist
   * Use this to exclude sensitive data or temporary state from being persisted
   * @param state - The current state
   * @returns A partial state object containing only the values to be persisted
   */
  partialize?: (state: T) => Partial<T>;

  /**
   * Function called after state hydration completes
   * This is useful for running logic that depends on the persisted state being loaded
   * @param state - The hydrated state or undefined if hydration failed
   */
  onRehydrateStorage?: (state: T | undefined) => void;

  /**
   * Version of the persisted state (for migrations)
   * Increment this when your state structure changes to trigger migrations
   */
  version?: number;

  /**
   * Function to migrate data between versions
   * Use this to handle breaking changes in your state structure
   * @param persistedState - The state as it was persisted in storage
   * @param version - The version number of the persisted state
   * @returns The migrated state compatible with the current version
   */
  migrate?: (persistedState: unknown, version: number) => T | Promise<T>;

  /**
   * Merge the persisted state with the initial state
   * This controls how the loaded state is combined with your initial state
   * @param persistedState - The state loaded from storage
   * @param currentState - The current state in the store
   * @returns The merged state
   */
  merge?: (persistedState: unknown, currentState: T) => T;
}

/**
 * Interface for JSON storage reviver/replacer options
 */
export interface JSONStorageOptions {
  /**
   * Function that transforms values during JSON.parse
   * This is passed directly to JSON.parse as the reviver parameter
   */
  reviver?: <T>(key: string, value: T) => T;

  /**
   * Function that transforms values during JSON.stringify
   * This is passed directly to JSON.stringify as the replacer parameter
   */
  replacer?: <T>(key: string, value: T) => T;
}

/**
 * Creates a storage adapter that handles JSON serialization and deserialization
 *
 * This helper creates a StateStorage implementation that automatically handles
 * converting state objects to and from JSON strings. It works with any storage
 * that supports the basic getItem/setItem/removeItem methods.
 *
 * @param getStorage - Function that returns a storage implementation
 * @param options - Optional JSON parse/stringify configuration
 * @returns A StateStorage implementation with JSON handling
 *
 * @example
 * ```ts
 * // Using with localStorage (default)
 * const storage = createJSONStorage(() => localStorage);
 *
 * // Using with sessionStorage
 * const storage = createJSONStorage(() => sessionStorage);
 *
 * // With custom reviver/replacer for handling special objects like Date
 * const storage = createJSONStorage(() => localStorage, {
 *   reviver: (key, value) => {
 *     if (value && value.type === 'date') return new Date(value.data);
 *     return value;
 *   },
 *   replacer: (key, value) => {
 *     if (value instanceof Date) return { type: 'date', data: value.toISOString() };
 *     return value;
 *   }
 * });
 * ```
 */
export const createJSONStorage = (
  getStorage: () => Storage | StateStorage,
  options?: JSONStorageOptions,
): StateStorage => ({
  getItem: (name) => {
    const storage = getStorage();
    const value = storage.getItem(name);
    if (value === null) return null;

    return Effect.tryPromise({
      try: () => Promise.resolve(JSON.parse(value as string, options?.reviver)),
      catch: (e) => {
        console.warn("Error parsing stored JSON, returning raw value:", e);
        return value;
      },
    }).pipe(Effect.runSync);
  },
  setItem: (name, value) => {
    const storage = getStorage();
    const stringifiedValue = Effect.tryPromise({
      try: () => Promise.resolve(JSON.stringify(value, options?.replacer)),
      catch: (e) => {
        console.error("Error stringifying value for storage:", e);
        throw e; // Re-throw to let the caller know the operation failed
      },
    }).pipe(Effect.runSync);

    return Effect.tryPromise({
      try: () => {
        const result = storage.setItem(name, stringifiedValue);
        return Promise.resolve(result);
      },
      catch: (e) => {
        console.error("Error storing value in storage:", e);
        throw e; // Re-throw to let the caller know the operation failed
      },
    }).pipe(Effect.runSync);
  },
  removeItem: (name) => {
    const storage = getStorage();
    return Effect.tryPromise({
      try: () => {
        const result = storage.removeItem(name);
        return Promise.resolve(result);
      },
      catch: (e) => {
        console.error("Error removing item from storage:", e);
        throw e;
      },
    }).pipe(Effect.runSync);
  },
});

/**
 * Represents the current state of hydration from persistent storage
 *
 * - NOT_HYDRATED: Initial state, hydration has not started
 * - HYDRATING: Currently reading from storage and updating the store
 * - HYDRATED: Successfully completed hydration
 */
type HydrationStatus = "NOT_HYDRATED" | "HYDRATING" | "HYDRATED";

/**
 * Extended API that gets added to the store by the persist middleware
 *
 * These methods provide information about the hydration status and
 * ways to respond to hydration events.
 *
 * @template T Type of the store state
 */
export interface PersistApi<T> {
  persist: {
    /**
     * Checks if the store has completed hydration from storage
     *
     * @returns `true` if the store has been hydrated, `false` otherwise
     *
     * @example
     * ```ts
     * // Only show the UI when the store has been hydrated
     * const App = () => {
     *   const hasHydrated = useStore(state => state.persist.hasHydrated());
     *
     *   if (!hasHydrated) {
     *     return <LoadingScreen />;
     *   }
     *
     *   return <MainApp />;
     * };
     * ```
     */
    hasHydrated: () => boolean;

    /**
     * Registers a callback to be called after hydration with the current state
     *
     * @param fn - Function to call with the hydrated state
     * @returns Unsubscribe function to cancel the callback
     *
     * @example
     * ```ts
     * useEffect(() => {
     *   const unsubscribe = store.persist.onHydrate((state) => {
     *     console.log('Store has been hydrated with:', state);
     *   });
     *
     *   return unsubscribe;
     * }, []);
     * ```
     */
    onHydrate: (fn: (state: T) => void) => () => void;

    /**
     * Registers a callback to be called when hydration finishes
     *
     * @param fn - Function to call when hydration completes
     * @returns Unsubscribe function to cancel the callback
     *
     * @example
     * ```ts
     * useEffect(() => {
     *   const unsubscribe = store.persist.onFinishHydration(() => {
     *     console.log('Hydration process completed');
     *   });
     *
     *   return unsubscribe;
     * }, []);
     * ```
     */
    onFinishHydration: (fn: () => void) => () => void;

    /**
     * Clears the persisted state from storage
     *
     * This removes the data from storage but doesn't reset the current state.
     * To reset the state as well, you should call setState after clearing storage.
     *
     * @example
     * ```ts
     * // Clear persisted data (for logout, etc.)
     * const handleLogout = () => {
     *   store.persist.clearStorage();
     *   store.setState({ user: null, ...initialState });
     * };
     * ```
     */
    clearStorage: () => void;
  };
}

/**
 * Interface for versioned persisted state
 */
export interface VersionedState {
  version: number;
  [key: string]: unknown;
}

/**
 * Persist middleware to save state in a storage system
 *
 * This middleware adds persistence capabilities to a store, allowing state to be
 * saved to and loaded from a storage system like localStorage. It handles serialization,
 * automatic saving on state changes, and initial hydration from saved state.
 *
 * @template T Type of the store state
 * @param stateCreator - The original state creator function
 * @param options - Configuration options for persistence
 * @returns A wrapped state creator function with persistence
 *
 * @example
 * ```ts
 * // Basic usage with localStorage
 * const useStore = create(
 *   persist(
 *     (set, get) => ({
 *       count: 0,
 *       increment: () => set(state => ({ count: state.count + 1 })),
 *     }),
 *     { name: 'my-counter-storage' }
 *   )
 * );
 *
 * // Advanced usage with custom storage and partial persistence
 * const useStore = create(
 *   persist(
 *     (set, get) => ({
 *       user: null,
 *       preferences: { theme: 'light' },
 *       isLoading: false,
 *       setUser: (user) => set({ user }),
 *       setTheme: (theme) => set(state => ({
 *         preferences: { ...state.preferences, theme }
 *       })),
 *     }),
 *     {
 *       name: 'user-storage',
 *       storage: createJSONStorage(() => sessionStorage),
 *       partialize: (state) => ({ user: state.user, preferences: state.preferences }),
 *     }
 *   )
 * );
 * ```
 */
export const persist = <T extends object>(
  stateCreator: StateCreator<T>,
  options: PersistOptions<T>,
): StateCreator<T> => {
  const {
    name,
    storage = createJSONStorage(() => localStorage),
    partialize = (state) => state as Partial<T>,
    onRehydrateStorage,
    version = 0,
    migrate,
    merge = (persistedState, currentState) => ({
      ...currentState,
      ...(persistedState as Partial<T>),
    }),
  } = options;

  let hydrationStatus: HydrationStatus = "NOT_HYDRATED";
  let hydrationResolve: () => void = () => {};
  const hydrationPromise = new Promise<void>((resolve) => {
    hydrationResolve = resolve;
  });

  return (set: SetState<T>, get: GetState<T>) => {
    // Function to hydrate the state
    const hydrate = async () => {
      if (hydrationStatus !== "NOT_HYDRATED") return;
      hydrationStatus = "HYDRATING";

      try {
        const storedValueEffect = Effect.tryPromise({
          try: async () => await storage.getItem(name),
          catch: (error) => {
            console.error("Error retrieving persisted state:", error);
            return null;
          },
        });

        const storedValue = await Effect.runPromise(storedValueEffect);

        if (storedValue) {
          const hydrateStateEffect = Effect.tryPromise({
            try: async () => {
              let deserializedState: unknown =
                typeof storedValue === "string"
                  ? JSON.parse(storedValue)
                  : storedValue;

              // Migrate state if necessary
              const versionedState =
                deserializedState as Partial<VersionedState>;
              if (
                migrate &&
                typeof deserializedState === "object" &&
                deserializedState !== null &&
                "version" in versionedState &&
                versionedState.version !== version
              ) {
                deserializedState = await migrate(
                  deserializedState,
                  versionedState.version ?? 0,
                );
              }

              // Merge persisted state with current state
              const currentState = get();
              return merge(deserializedState, currentState);
            },
            catch: (error) => {
              console.error("Error during state hydration:", error);
              return undefined;
            },
          });

          const mergedState = await Effect.runPromise(hydrateStateEffect);

          if (mergedState !== undefined) {
            // Update the state
            set(mergedState, true);
          }

          // Call the onRehydrateStorage callback
          onRehydrateStorage?.(mergedState);
        } else {
          onRehydrateStorage?.(get());
        }
      } catch (error) {
        console.error("Unexpected error during hydration process:", error);
        onRehydrateStorage?.(undefined);
      }

      hydrationStatus = "HYDRATED";
      hydrationResolve();
    };

    // Function to persist the state
    const persistState = (state: T) => {
      const persistedState: VersionedState = {
        ...partialize(state),
        version,
      };

      // Only persist if the state has been hydrated
      if (hydrationStatus === "HYDRATED") {
        Effect.tryPromise({
          try: async () => {
            await storage.setItem(name, JSON.stringify(persistedState));
            return true;
          },
          catch: (error) => {
            console.error("Error persisting state:", error);
            return false;
          },
        }).pipe(Effect.runSync);
      }
    };

    // Wrap the set function to persist after each modification
    // Note: We use `any` here because the complex generic type in SetState<T> is challenging
    // to match exactly. This cast is safe as we're forwarding the arguments directly to
    // the original `set` function which has the correct typing.
    const persistSet = (stateOrFn: any, replace?: boolean) => {
      // Apply the update via the original set
      set(stateOrFn, replace);
      // Persist the updated state
      persistState(get());
    };

    // Initialize the base state
    const state = stateCreator(persistSet, get);

    // Start hydration
    hydrate();

    // Extend the API to add persist methods
    // This part is only used by createStore/createEffectStore
    // and is not directly used by the middleware
    if (typeof window !== "undefined") {
      const persistApi: PersistApi<T> = {
        persist: {
          hasHydrated: () => hydrationStatus === "HYDRATED",
          onHydrate: (fn: (state: T) => void) => {
            const subscribed = get();
            if (hydrationStatus === "HYDRATED") {
              fn(subscribed);
              return () => {};
            }

            // We need this type assertion because we're using the function
            // in a way that's compatible with the subscribe method,
            // but TypeScript doesn't know that
            type SubscribeFunction = (
              listener: (state: T) => void,
            ) => () => void;
            const subscribe =
              fn as unknown as Store<T>["subscribe"] as SubscribeFunction;

            const unsubscribe = subscribe((state: T) => {
              if (hydrationStatus === "HYDRATED") {
                fn(state);
                unsubscribe();
              }
            });
            return unsubscribe;
          },
          onFinishHydration: (fn: () => void) => {
            if (hydrationStatus === "HYDRATED") {
              fn();
              return () => {};
            }
            let cancelled = false;
            hydrationPromise.then(() => {
              if (!cancelled) fn();
            });
            return () => {
              cancelled = true;
            };
          },
          clearStorage: () => {
            storage.removeItem(name);
          },
        },
      };

      Object.assign(state, persistApi);
    }

    return state;
  };
};
