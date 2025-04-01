# Advanced React Hooks with Effect

This module provides a collection of advanced React hooks that leverage the [Effect](https://effect.website/) library to handle complex scenarios such as state management, concurrency, cancellations, timeouts, and retries.

## Table of Contents

- [Installation](#installation)
- [Available Hooks](#available-hooks)
  - [useCancellable](#usecancellable)
  - [useRetry](#useretry)
  - [useSWR](#useswr)
  - [useReducerWithEffect](#usereducerwitheffect)
  - [usePrioritizedEffects](#useprioritizedeffects)
- [Usage Examples](#usage-examples)

## Installation

These hooks require the `effect` library as a dependency:

```bash
npm install effect
```

## Available Hooks

### useCancellable

A hook to manage cancellable effects with a configurable timeout.

#### Usage

```tsx
const { data, error, isLoading, run, cancel } = useCancellable<User, AppError>(
  fetchUserEffect(userId),
  {
    timeout: 5000, // 5 seconds
    immediate: true,
    onSuccess: (data) => console.log('User loaded:', data),
    onError: (error) => console.error('Error loading:', error)
  }
);
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | `number \| undefined` | `undefined` | Timeout in ms before aborting the operation |
| `immediate` | `boolean` | `false` | Execute the effect immediately on mount |
| `onSuccess` | `(data: A) => void` | `undefined` | Callback executed when the effect succeeds |
| `onError` | `(error: E) => void` | `undefined` | Callback executed when the effect fails |
| `deps` | `any[]` | `[]` | Dependencies to trigger the effect automatically |

#### Return Value

| Property | Type | Description |
|-----------|------|-------------|
| `data` | `A \| undefined` | The data returned by the effect |
| `error` | `E \| undefined` | The error if the effect fails |
| `isLoading` | `boolean` | Indicates if the effect is executing |
| `run` | `() => void` | Function to execute/restart the effect |
| `cancel` | `() => void` | Function to cancel the current effect |

### useRetry

A hook to manage automatic retries after a failure, with configurable strategies.

#### Usage

```tsx
const { data, error, isLoading, retryCount, run, retry } = useRetry<Comment[], AppError>(
  fetchCommentsEffect(postId),
  {
    maxRetries: 3,
    baseDelay: 1000,
    retryStrategy: 'exponential',
    immediate: true
  }
);
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxRetries` | `number` | `3` | Maximum number of retry attempts |
| `baseDelay` | `number` | `1000` | Base delay between retry attempts (ms) |
| `retryStrategy` | `'constant' \| 'linear' \| 'exponential'` | `'exponential'` | Timing strategy |
| `immediate` | `boolean` | `false` | Execute the effect immediately on mount |
| `onSuccess` | `(data: A) => void` | `undefined` | Callback executed when the effect succeeds |
| `onError` | `(error: E) => void` | `undefined` | Callback executed when the effect fails |
| `deps` | `any[]` | `[]` | Dependencies to trigger the effect automatically |

#### Return Value

| Property | Type | Description |
|-----------|------|-------------|
| `data` | `A \| undefined` | The data returned by the effect |
| `error` | `E \| undefined` | The error if the effect fails after all retries |
| `isLoading` | `boolean` | Indicates if the effect is executing |
| `retryCount` | `number` | Current number of retry attempts |
| `run` | `() => void` | Function to execute/restart the effect |
| `retry` | `() => void` | Function to retry after a failure |

### useSWR

A hook inspired by SWR (Stale-While-Revalidate) for data fetching and caching with automatic revalidation.

#### Usage

```tsx
const { data, error, isValidating, revalidate } = useSWR<Post[], AppError>(
  fetchUserPostsEffect(userId),
  {
    key: `posts-${userId}`,
    revalidateOnFocus: true
  }
);
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `key` | `string` | Required | Unique key to identify cached data |
| `dedupingInterval` | `number` | `2000` | Interval for request deduplication (ms) |
| `revalidateOnFocus` | `boolean` | `true` | Revalidate when window regains focus |
| `revalidateOnReconnect` | `boolean` | `true` | Revalidate when connection is restored |
| `revalidateIfStale` | `boolean` | `true` | Revalidate if data is stale |
| `onSuccess` | `(data: A) => void` | `undefined` | Callback when fetching succeeds |
| `onError` | `(error: E) => void` | `undefined` | Callback when fetching fails |

#### Return Value

| Property | Type | Description |
|-----------|------|-------------|
| `data` | `A \| undefined` | The fetched and cached data |
| `error` | `E \| undefined` | The fetch error |
| `isValidating` | `boolean` | Indicates if revalidation is in progress |
| `revalidate` | `() => void` | Function to force revalidation |
| `mutate` | `(newData: A) => void` | Function to update cached data |

### useReducerWithEffect

An extension of `useReducer` that executes side effects in response to specific actions.

#### Usage

```tsx
const { state, dispatch, isEffectRunning, cancelEffect } = useReducerWithEffect<UserState, any, AppError>(
  userReducer,
  {
    initialState: { user: null, loading: false, error: null, role: 'user' },
    effectFactory: () => fetchUserEffect(userId)
  }
);

// Trigger an effect
dispatch({ type: 'effect/start', payload: userId, runEffect: true });
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `initialState` | `S` | Required | Initial reducer state |
| `shouldRunEffect` | `(state: S, action: A) => boolean` | `(_, action) => !!action.runEffect` | Determines if an action should trigger an effect |
| `effectFactory` | `(state: S, action: A) => Effect \| null` | `undefined` | Factory for creating effects based on state and action |
| `onEffectSuccess` | `(state: S, action: A) => void` | `undefined` | Callback when effect succeeds |
| `onEffectError` | `(error: E, state: S, action: A) => void` | `undefined` | Callback when effect fails |

#### Return Value

| Property | Type | Description |
|-----------|------|-------------|
| `state` | `S` | Current reducer state |
| `dispatch` | `(action: A) => void` | Function to dispatch actions |
| `isEffectRunning` | `boolean` | Indicates if an effect is executing |
| `effectError` | `E \| undefined` | The effect error if failure |
| `cancelEffect` | `() => void` | Function to cancel the current effect |

### usePrioritizedEffects

A hook to manage and sequence effects with priorities and dependencies.

#### Usage

```tsx
const { 
  resources, 
  isProcessing,
  start: loadAll, 
  clear: cancelAll, 
  addEffect: loadResource, 
  removeEffect: cancelResource,
  getResourceState,
  isLoading
} = usePrioritizedEffects({
  autoStart: true,
  concurrency: 2
});

// Create and add an effect
loadResource({
  id: 'user',
  priority: { level: PriorityLevel.High, weight: 100 },
  effect: fetchUserEffect('123'),
  dependencies: []
});
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `concurrency` | `number` | `3` | Maximum number of concurrent effects |
| `autoStart` | `boolean` | `false` | Automatically start processing on mount |
| `onComplete` | `() => void` | `undefined` | Callback when all effects are complete |

#### Return Value

| Property | Type | Description |
|-----------|------|-------------|
| `addEffect` | `(effect: PrioritizedEffect<A, E>) => void` | Adds an effect to the queue |
| `removeEffect` | `(id: string) => void` | Removes an effect from the queue |
| `getResourceState` | `(id: string) => ResourceState` | Gets the state of a resource |
| `resources` | `Map<string, Resource<any, any>>` | Map of all resources |
| `isEmpty` | `boolean` | Indicates if the queue is empty |
| `isProcessing` | `boolean` | Indicates if processing is active |
| `start` | `() => void` | Starts processing |
| `pause` | `() => void` | Pauses processing |
| `clear` | `() => void` | Stops and clears all effects |
| `getResult` | `<A>(id: string) => A \| undefined` | Gets the result of an effect |
| `getError` | `<E>(id: string) => E \| undefined` | Gets the error of an effect |
| `isLoading` | `(id: string) => boolean` | Checks if a resource is loading |

## Usage Examples

Check the file `src/examples/hooks/advanced-hooks-demo.tsx` for complete examples of each hook in action.

### Complete Dashboard Example with usePrioritizedEffects

```tsx
function Dashboard() {
  // Define priority levels
  const priorityMapping = {
    critical: { level: PriorityLevel.High, weight: 100 },
    high: { level: PriorityLevel.High, weight: 50 },
    medium: { level: PriorityLevel.Medium, weight: 50 }
  };

  // Initialize the hook
  const { 
    resources, 
    isProcessing, 
    start: loadAll, 
    clear: cancelAll, 
    addEffect: loadResource, 
    removeEffect: cancelResource,
    getResourceState,
    isLoading
  } = usePrioritizedEffects({
    autoStart: true,
    concurrency: 2
  });
  
  // Helper function to create a prioritized effect
  const createEffect = (
    id: string, 
    priority: keyof typeof priorityMapping, 
    effect: Effect.Effect<any, AppError, never>, 
    dependencies?: string[]
  ) => ({
    id,
    priority: priorityMapping[priority],
    effect,
    dependencies
  });
  
  // Load resources on mount
  useEffect(() => {
    loadResource(createEffect('user', 'critical', fetchUserEffect('123')));
    loadResource(createEffect('posts', 'high', fetchUserPostsEffect('123'), ['user']));
    loadResource(createEffect('comments', 'medium', fetchCommentsEffect('1'), ['posts']));
  }, []);
  
  return (
    <div>
      {/* Dashboard UI */}
    </div>
  );
} 