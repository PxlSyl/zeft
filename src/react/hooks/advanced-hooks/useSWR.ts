import { useCallback, useEffect, useRef, useState } from "react";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { pipe } from "effect/Function";
import * as Option from "effect/Option";

/**
 * Options for useSWR hook
 */
export interface UseSWROptions<A, E> {
  /**
   * Key for caching the data
   */
  key: string;

  /**
   * Time in milliseconds after which data is considered stale
   */
  staleTime?: number;

  /**
   * Time in milliseconds to keep data in cache
   */
  cacheTime?: number;

  /**
   * Whether to revalidate on focus
   */
  revalidateOnFocus?: boolean;

  /**
   * Whether to revalidate on reconnect
   */
  revalidateOnReconnect?: boolean;

  /**
   * Whether to refetch automatically when stale
   */
  revalidateIfStale?: boolean;

  /**
   * Whether to dedupe duplicate requests
   */
  dedupingInterval?: number;

  /**
   * Whether to run the effect immediately on mount
   */
  immediate?: boolean;

  /**
   * Callback called when the effect succeeds
   */
  onSuccess?: (data: A) => void;

  /**
   * Callback called when the effect fails
   */
  onError?: (error: E) => void;

  /**
   * Dependencies array for the effect
   */
  deps?: any[];
}

/**
 * Result of useSWR hook
 */
export interface UseSWRResult<A, E> {
  /**
   * The result data, if available
   */
  data: A | undefined;

  /**
   * The error, if any
   */
  error: E | undefined;

  /**
   * Whether the effect is currently running
   */
  isLoading: boolean;

  /**
   * Whether data is being revalidated in the background
   */
  isValidating: boolean;

  /**
   * Function to manually trigger revalidation
   */
  revalidate: () => void;

  /**
   * Function to mutate the local data without making a request
   */
  mutate: (data: A) => void;
}

// Type for timestamped cache entries
interface CacheEntry<A> {
  data: A;
  timestamp: number;
}

// A global cache shared across all hook instances
const globalCache = new Map<string, CacheEntry<any>>();

/**
 * Hook for data fetching with stale-while-revalidate caching strategy
 * @template A The type of the result value
 * @template E The type of the error
 * @param effect The Effect to run
 * @param options Options for controlling caching and revalidation
 * @returns Object containing state and functions to control the effect
 */
export function useSWR<A, E>(
  effect: Effect.Effect<A, E, never>,
  options: UseSWROptions<A, E>,
): UseSWRResult<A, E> {
  const {
    key,
    staleTime = 5 * 60 * 1000, // 5 minutes
    cacheTime = 30 * 60 * 1000, // 30 minutes
    revalidateOnFocus = true,
    revalidateOnReconnect = true,
    revalidateIfStale = true,
    dedupingInterval = 2000, // 2 seconds
    immediate = true,
    onSuccess,
    onError,
    deps = [],
  } = options;

  // State
  const [data, setData] = useState<A | undefined>(undefined);
  const [error, setError] = useState<E | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  // Refs
  const effectRef = useRef(effect);
  const keyRef = useRef(key);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const staleTimeRef = useRef(staleTime);
  const lastFetchTimeRef = useRef<number | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const fiberRef = useRef<Fiber.RuntimeFiber<A, E> | null>(null);
  const lastPromiseRef = useRef<Promise<A> | null>(null);

  // Update refs when dependencies change
  useEffect(() => {
    effectRef.current = effect;
    keyRef.current = key;
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
    staleTimeRef.current = staleTime;
  }, [effect, key, onSuccess, onError, staleTime, ...deps]);

  // Cleanup function
  useEffect(() => {
    return () => {
      if (fiberRef.current) {
        Effect.runPromise(Fiber.interrupt(fiberRef.current)).catch(() => {});
      }
    };
  }, []);

  // Function to retrieve data from cache
  const getFromCache = useCallback((): Effect.Effect<
    Option.Option<CacheEntry<A>>,
    never,
    never
  > => {
    return pipe(
      // Attempt to get the cache entry
      Effect.sync(
        () => globalCache.get(keyRef.current) as CacheEntry<A> | undefined,
      ),
      // Handle potential errors from cache access
      Effect.catchAll(() => Effect.succeed(undefined)),
      // Process the result
      Effect.map((entry) => {
        if (!entry) {
          return Option.none();
        }

        // Check if entry has expired according to cacheTime
        const currentTime = Date.now();
        if (currentTime - entry.timestamp > cacheTime) {
          // Entry has expired, remove it from cache
          globalCache.delete(keyRef.current);
          return Option.none();
        }

        return Option.some(entry);
      }),
    );
  }, [cacheTime]);

  // Function to save data to cache
  const saveToCache = useCallback(
    (value: A): Effect.Effect<void, never, never> => {
      return Effect.sync(() => {
        const entry: CacheEntry<A> = {
          data: value,
          timestamp: Date.now(),
        };

        globalCache.set(keyRef.current, entry);
      });
    },
    [],
  );

  // Function to handle successful fetch
  const handleSuccess = useCallback(
    (result: A): Effect.Effect<void, never, never> => {
      return pipe(
        // Save result to cache
        saveToCache(result),
        // Update UI state
        Effect.flatMap(() =>
          Effect.sync(() => {
            setData(result);
            setError(undefined);
            setIsLoading(false);
            setIsValidating(false);

            // Update refs
            lastFetchTimeRef.current = Date.now();
            isFetchingRef.current = false;
            fiberRef.current = null;

            // Call success callback
            if (onSuccessRef.current) {
              onSuccessRef.current(result);
            }
          }),
        ),
      );
    },
    [saveToCache],
  );

  // Function to handle fetch error
  const handleError = useCallback(
    (err: E): Effect.Effect<void, never, never> => {
      return Effect.sync(() => {
        setError(err);
        setIsLoading(false);
        setIsValidating(false);

        // Update refs
        isFetchingRef.current = false;
        fiberRef.current = null;

        // Call error callback
        if (onErrorRef.current) {
          onErrorRef.current(err);
        }
      });
    },
    [],
  );

  // Function to fetch data
  const fetchData = useCallback(
    async (shouldUpdateLoading = true): Promise<A> => {
      // If we're already fetching, return the existing promise to prevent duplicates
      if (
        isFetchingRef.current &&
        lastPromiseRef.current &&
        dedupingInterval > 0
      ) {
        return lastPromiseRef.current;
      }

      // Try to get from cache first
      const cachedDataOption = await Effect.runPromise(getFromCache());

      // Process cached data if available
      if (Option.isSome(cachedDataOption)) {
        const cacheEntry = cachedDataOption.value;
        const value = cacheEntry.data;
        setData(value);
        setError(undefined);

        // If the data is fresh enough or we don't want to revalidate stale data, return it
        const dataAge = Date.now() - cacheEntry.timestamp;
        if (dataAge < staleTimeRef.current || !revalidateIfStale) {
          return value;
        }

        // Otherwise, continue with background fetch
      }

      // Update loading state
      if (shouldUpdateLoading) {
        setIsLoading(data === undefined);
      }
      setIsValidating(true);

      // Set flag to prevent duplicate requests
      isFetchingRef.current = true;

      // Create the complete fetch effect
      const completeFetchEffect = pipe(
        // Cancel any previous operation if exists
        Effect.suspend(() => {
          if (fiberRef.current) {
            return pipe(
              Effect.logDebug("Cancelling previous request"),
              Effect.flatMap(() =>
                Fiber.interrupt(fiberRef.current as Fiber.Fiber<A, E>),
              ),
              Effect.catchAll(() => Effect.unit),
            );
          }
          return Effect.unit;
        }),

        // Execute main effect
        Effect.flatMap(() => effectRef.current),

        // Handle success and update state
        Effect.flatMap((result) =>
          handleSuccess(result).pipe(Effect.map(() => result)),
        ),

        // Handle errors functionally
        Effect.catchAll((err) =>
          pipe(
            handleError(err),
            Effect.flatMap(() => Effect.fail(err)),
          ),
        ),
      );

      // Fork the effect and store the fiber for potential cancellation
      const fiber = Effect.runFork(completeFetchEffect);
      fiberRef.current = fiber;

      // Create a promise to return
      const fetchPromise = Effect.runPromise(Fiber.join(fiber));
      lastPromiseRef.current = fetchPromise;

      return fetchPromise;
    },
    [
      dedupingInterval,
      getFromCache,
      handleError,
      handleSuccess,
      revalidateIfStale,
    ],
  );

  // Function to manually revalidate (exposed to user)
  const revalidate = useCallback(() => {
    return fetchData(false);
  }, [fetchData]);

  // Function to manually update data without fetching
  const mutate = useCallback(
    (newData: A) => {
      pipe(
        // Update the cached data
        saveToCache(newData),
        // Update React state with the new data
        Effect.flatMap(() =>
          Effect.sync(() => {
            setData(newData);
            lastFetchTimeRef.current = Date.now();
          }),
        ),
        // Handle any potential errors during the process
        Effect.catchAll(() =>
          Effect.sync(() => {
            // Even if cache update fails, we still want to update the UI
            setData(newData);
            lastFetchTimeRef.current = Date.now();
          }),
        ),
        // Execute the effect
        Effect.runPromise,
      ).catch(() => {
        // Fail silently in the unlikely case of runtime errors
      });
    },
    [saveToCache],
  );

  // Schedule cache cleanup for entries that have expired
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      globalCache.forEach((entry, entryKey) => {
        if (now - entry.timestamp > cacheTime) {
          globalCache.delete(entryKey);
        }
      });
    }, cacheTime / 2); // Run cleanup at half the cache time

    return () => {
      clearInterval(cleanupInterval);
    };
  }, [cacheTime]);

  // Effect to revalidate on focus if enabled
  useEffect(() => {
    if (!revalidateOnFocus) return;

    const onFocus = () => {
      revalidate();
    };

    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, [revalidate, revalidateOnFocus]);

  // Effect to revalidate on reconnect if enabled
  useEffect(() => {
    if (!revalidateOnReconnect) return;

    const onOnline = () => {
      revalidate();
    };

    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, [revalidate, revalidateOnReconnect]);

  // Initial fetch
  useEffect(() => {
    if (immediate) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, immediate]);

  return {
    data,
    error,
    isLoading,
    isValidating,
    revalidate,
    mutate,
  };
}
