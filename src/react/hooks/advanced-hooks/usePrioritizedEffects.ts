import { useCallback, useEffect, useRef, useState } from "react";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Context from "effect/Context";

/**
 * Priority level for effects
 */
export enum PriorityLevel {
  High = 0,
  Medium = 5,
  Low = 10,
}

/**
 * Priority information
 */
export interface Priority {
  level: PriorityLevel;
  weight: number;
}

/**
 * Effect with priority information
 */
export interface PrioritizedEffect<A, E> {
  effect: Effect.Effect<A, E, never>;
  priority: Priority;
  id: string;
  dependencies?: string[];
}

/**
 * Resource managed by the prioritized effects hook
 */
export interface Resource<A, E> {
  id: string;
  result?: A;
  error?: E;
  isLoading: boolean;
  dependencies: string[];
  priority: Priority;
}

/**
 * Reference to a dependency resource
 */
export interface ResourceDependency {
  id: string;
  optional?: boolean;
}

/**
 * Possible states for a resource
 */
export enum ResourceState {
  NotStarted = "not_started",
  Loading = "loading",
  Success = "success",
  Error = "error",
}

/**
 * Options for usePrioritizedEffects hook
 */
export interface UsePrioritizedOptions {
  /**
   * Maximum concurrent effects to run
   */
  concurrency?: number;

  /**
   * Whether to automatically start processing the queue
   */
  autoStart?: boolean;

  /**
   * Callback when all effects are completed
   */
  onComplete?: () => void;
}

/**
 * Result of usePrioritizedEffects hook
 */
export interface UsePrioritizedResult<A = any, E = any> {
  /**
   * Add an effect to the queue
   */
  addEffect: <A, E>(effect: PrioritizedEffect<A, E>) => void;

  /**
   * Remove an effect from the queue
   */
  removeEffect: (id: string) => void;

  /**
   * Get the current resource state
   */
  getResourceState: (id: string) => ResourceState;

  /**
   * Get all resources
   */
  resources: Map<string, Resource<any, any>>;

  /**
   * Check if the queue is empty
   */
  isEmpty: boolean;

  /**
   * Check if processing is currently active
   */
  isProcessing: boolean;

  /**
   * Start processing the queue
   */
  start: () => void;

  /**
   * Pause processing
   */
  pause: () => void;

  /**
   * Stop and clear all effects
   */
  clear: () => void;

  /**
   * Get the result of an effect
   */
  getResult: <A>(id: string) => A | undefined;

  /**
   * Get the error of an effect
   */
  getError: <E>(id: string) => E | undefined;

  /**
   * Get loading state of an effect
   */
  isLoading: (id: string) => boolean;
}

// Create a context for priority information
const PriorityContext = Context.GenericTag<Priority>("PriorityContext");

/**
 * Hook to manage and process effects with priorities and dependencies
 * @param options Configuration options
 * @returns Object containing functions to manage the prioritized effects
 */
export function usePrioritizedEffects(
  options: UsePrioritizedOptions = {},
): UsePrioritizedResult {
  const { concurrency = 3, autoStart = true, onComplete } = options;

  // State
  const [isEmpty, setIsEmpty] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Refs
  const effectQueueRef = useRef<PrioritizedEffect<any, any>[]>([]);
  const runningEffectsRef = useRef<Set<string>>(new Set());
  const resourcesRef = useRef<Map<string, Resource<any, any>>>(new Map());
  const fiberMapRef = useRef<Map<string, Fiber.RuntimeFiber<any, any>>>(
    new Map(),
  );
  const onCompleteRef = useRef(onComplete);
  const concurrencyRef = useRef(concurrency);

  // Update refs when dependencies change
  useEffect(() => {
    onCompleteRef.current = onComplete;
    concurrencyRef.current = concurrency;
  }, [concurrency, onComplete]);

  // Resource management functions
  const getResourceState = useCallback((id: string): ResourceState => {
    const resource = resourcesRef.current.get(id);

    if (!resource) {
      return ResourceState.NotStarted;
    }

    if (resource.isLoading) {
      return ResourceState.Loading;
    }

    if (resource.error !== undefined) {
      return ResourceState.Error;
    }

    if (resource.result !== undefined) {
      return ResourceState.Success;
    }

    return ResourceState.NotStarted;
  }, []);

  const getResult = useCallback(<A>(id: string): A | undefined => {
    const resource = resourcesRef.current.get(id);
    return resource?.result as A | undefined;
  }, []);

  const getError = useCallback(<E>(id: string): E | undefined => {
    const resource = resourcesRef.current.get(id);
    return resource?.error as E | undefined;
  }, []);

  const isLoading = useCallback((id: string): boolean => {
    const resource = resourcesRef.current.get(id);
    return !!resource?.isLoading;
  }, []);

  // Check if dependencies are ready
  const areDependenciesReady = useCallback(
    (dependencies: string[] = []): boolean => {
      for (const depId of dependencies) {
        const state = getResourceState(depId);
        if (state !== ResourceState.Success) {
          return false;
        }
      }
      return true;
    },
    [getResourceState],
  );

  // Process the next effect in queue
  const processNextEffect = useCallback(() => {
    // If we're at concurrency limit, don't process more
    if (runningEffectsRef.current.size >= concurrencyRef.current) {
      return;
    }

    // Sort queue by priority level and weight
    const queue = [...effectQueueRef.current].sort((a, b) => {
      // First compare by level
      const levelDiff = a.priority.level - b.priority.level;
      if (levelDiff !== 0) return levelDiff;

      // Then by weight
      return b.priority.weight - a.priority.weight;
    });

    // Find the first effect whose dependencies are met
    for (let i = 0; i < queue.length; i++) {
      const effectItem = queue[i];

      // Skip if already running
      if (runningEffectsRef.current.has(effectItem.id)) {
        continue;
      }

      // Check dependencies
      if (!areDependenciesReady(effectItem.dependencies)) {
        continue;
      }

      // Remove from queue
      effectQueueRef.current = effectQueueRef.current.filter(
        (e) => e.id !== effectItem.id,
      );

      // Mark as running
      runningEffectsRef.current.add(effectItem.id);

      // Create or update resource
      const existingResource = resourcesRef.current.get(effectItem.id);
      const resource: Resource<any, any> = existingResource || {
        id: effectItem.id,
        isLoading: true,
        dependencies: effectItem.dependencies || [],
        priority: effectItem.priority,
      };

      // Update loading state
      resource.isLoading = true;
      resourcesRef.current.set(effectItem.id, resource);

      // Provide priority context to the effect
      const effectWithContext = Effect.provideService(
        effectItem.effect,
        PriorityContext,
        effectItem.priority,
      );

      // Run the effect
      const fiber = Effect.runFork(effectWithContext);

      // Store fiber reference
      fiberMapRef.current.set(effectItem.id, fiber);

      // Monitor fiber completion
      Effect.runPromise(Fiber.join(fiber))
        .then((result) => {
          // Update resource
          const resource = resourcesRef.current.get(effectItem.id);
          if (resource) {
            resource.result = result;
            resource.isLoading = false;
            resourcesRef.current.set(effectItem.id, resource);
          }

          // Cleanup
          runningEffectsRef.current.delete(effectItem.id);
          fiberMapRef.current.delete(effectItem.id);

          // Process next effect(s)
          if (isProcessing) {
            // Process up to concurrency limit
            for (let j = 0; j < concurrencyRef.current; j++) {
              processNextEffect();
            }

            // Check if queue is empty
            checkQueueState();
          }
        })
        .catch((error) => {
          // Update resource
          const resource = resourcesRef.current.get(effectItem.id);
          if (resource) {
            resource.error = error;
            resource.isLoading = false;
            resourcesRef.current.set(effectItem.id, resource);
          }

          // Cleanup
          runningEffectsRef.current.delete(effectItem.id);
          fiberMapRef.current.delete(effectItem.id);

          // Process next effect(s)
          if (isProcessing) {
            // Process up to concurrency limit
            for (let j = 0; j < concurrencyRef.current; j++) {
              processNextEffect();
            }

            // Check if queue is empty
            checkQueueState();
          }
        });

      return;
    }
  }, [isProcessing, areDependenciesReady]);

  // Check if the queue and running effects are both empty
  const checkQueueState = useCallback(() => {
    const newIsEmpty =
      effectQueueRef.current.length === 0 &&
      runningEffectsRef.current.size === 0;

    setIsEmpty(newIsEmpty);

    // If everything is complete, call onComplete
    if (newIsEmpty && isProcessing && onCompleteRef.current) {
      onCompleteRef.current();
    }
  }, [isProcessing]);

  // Add an effect to the queue
  const addEffect = useCallback(
    <A, E>(effectItem: PrioritizedEffect<A, E>) => {
      // Add to queue
      effectQueueRef.current.push(effectItem);

      // Create resource entry if it doesn't exist
      if (!resourcesRef.current.has(effectItem.id)) {
        resourcesRef.current.set(effectItem.id, {
          id: effectItem.id,
          isLoading: false,
          dependencies: effectItem.dependencies || [],
          priority: effectItem.priority,
        });
      }

      // Update isEmpty state
      setIsEmpty(false);

      // Process next effect if we're processing
      if (isProcessing) {
        processNextEffect();
      }
    },
    [isProcessing, processNextEffect],
  );

  // Remove an effect from the queue
  const removeEffect = useCallback(
    (id: string) => {
      // Remove from queue
      effectQueueRef.current = effectQueueRef.current.filter(
        (e) => e.id !== id,
      );

      // If running, cancel it
      if (runningEffectsRef.current.has(id)) {
        const fiber = fiberMapRef.current.get(id);
        if (fiber) {
          Effect.runPromise(Fiber.interrupt(fiber)).catch(() => {});
        }

        runningEffectsRef.current.delete(id);
        fiberMapRef.current.delete(id);

        // Update resource state
        const resource = resourcesRef.current.get(id);
        if (resource) {
          resource.isLoading = false;
          resourcesRef.current.set(id, resource);
        }
      }

      // Check queue state
      checkQueueState();
    },
    [checkQueueState],
  );

  // Start processing the queue
  const start = useCallback(() => {
    setIsProcessing(true);

    // Process up to concurrency limit
    for (let i = 0; i < concurrencyRef.current; i++) {
      processNextEffect();
    }
  }, [processNextEffect]);

  // Pause processing
  const pause = useCallback(() => {
    setIsProcessing(false);
  }, []);

  // Clear all effects
  const clear = useCallback(() => {
    // Cancel all running effects
    for (const [id, fiber] of fiberMapRef.current) {
      Effect.runPromise(Fiber.interrupt(fiber)).catch(() => {});

      // Update resource state
      const resource = resourcesRef.current.get(id);
      if (resource) {
        resource.isLoading = false;
        resourcesRef.current.set(id, resource);
      }
    }

    // Clear internal state
    effectQueueRef.current = [];
    runningEffectsRef.current.clear();
    fiberMapRef.current.clear();

    // Reset state
    setIsProcessing(false);
    setIsEmpty(true);
  }, []);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart) {
      start();
    }

    return () => {
      // Cancel all running effects on unmount
      for (const fiber of fiberMapRef.current.values()) {
        Effect.runPromise(Fiber.interrupt(fiber)).catch(() => {});
      }
    };
  }, [autoStart, start]);

  return {
    addEffect,
    removeEffect,
    getResourceState,
    resources: resourcesRef.current,
    isEmpty,
    isProcessing,
    start,
    pause,
    clear,
    getResult,
    getError,
    isLoading,
  };
}
