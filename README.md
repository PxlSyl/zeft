# ZEFT

A lightweight state management library inspired by Zustand but powered by Effect. It provides a simple and efficient way to manage state in your applications, with built-in support for handling asynchronous operations and first-class React integration.

## Features

- 🚀 Simple and lightweight state management
- 🔄 Powered by Effect for better type safety and error handling
- ⚛️ First-class React support with optimized hooks
- 📦 Framework agnostic
- 🔍 TypeScript support
- 🎯 Minimal API surface
- 🔄 Built-in support for async operations
- 🎨 Customizable equality functions for selectors
- 🔄 Selective state updates with automatic diffing
- 🔪 Modular state with slices for better code organization
- 💾 Persist middleware for storing state in various storage systems

## Installation

```bash
npm install zeft
# or
yarn add zeft
# or
pnpm add zeft
```

## API Documentation

### Core Concepts

#### Store
The basic store provides state management with subscription capabilities and selective updates.

```typescript
import { createStore } from 'zeft'

interface TodoState {
  todos: string[]
  loading: boolean
  error: string | null
}

// Create a store with an initial state creator function
const todoStore = createStore<TodoState>((set, get) => ({
  todos: [],
  loading: false,
  error: null,
  // You can also add actions here if needed
  addTodo: (todo: string) => set(state => ({ todos: [...state.todos, todo] }))
}))

// Get current state
const currentState = todoStore.getState()

// Get a specific part of the state
const todos = todoStore.getStateSelective('todos')
const isLoading = todoStore.getStateSelective('loading')

// Update state with a function
todoStore.setState(state => ({ ...state, loading: true }))

// Update a single field with setStateSelective
todoStore.setStateSelective('loading', true)

// Update a single field with a function
todoStore.setStateSelective('todos', (prev) => [...prev, 'New Todo'])

// Subscribe to changes
const unsubscribe = todoStore.subscribe((state) => {
  console.log('New state:', state)
})
```

#### Effect Store
The effect store extends the basic store with the ability to run Effect operations.

```typescript
import { createEffectStore } from 'zeft'
import { createEffect } from 'zeft/effect'

// Create a store with effects support
const todoStore = createEffectStore<TodoState>((set, get) => ({
  todos: [],
  loading: false,
  error: null,
  // You can add actions here too
  addTodo: (todo: string) => set(state => ({ todos: [...state.todos, todo] }))
}))

// Create an effect
const fetchTodos = createEffect<Error, string[]>(async () => {
  const response = await fetch('https://api.example.com/todos')
  return response.json()
})

// Run an effect
todoStore.run(fetchTodos, {
  onSuccess: (todos) => {
    todoStore.setState(state => ({ ...state, todos, loading: false }))
  },
  onError: (error) => {
    todoStore.setState(state => ({ ...state, error: error.message, loading: false }))
  }
})
```

### Effect Utilities

#### createEffect
Creates an Effect from an async function:

```typescript
import { createEffect } from 'zeft/effect'

const fetchTodos = createEffect<Error, string[]>(async () => {
  const response = await fetch('https://api.example.com/todos')
  return response.json()
})
```

#### createEffectWithState
Creates an Effect that automatically updates the store state:

```typescript
import { createEffectWithState } from 'zeft/effect'

const fetchTodosEffect = createEffectWithState(
  fetchTodos,
  // Function to update state on success
  (result) => ({ todos: result, loading: false }),
  // Function to update state on error
  (error) => ({ error: error.message, loading: false })
)
```

#### createEffectWithCallback
Creates an Effect with success and error callbacks:

```typescript
import { createEffectWithCallback } from 'zeft/effect'

const fetchTodosWithCallbacks = createEffectWithCallback(fetchTodos, {
  onSuccess: (todos) => {
    console.log('Todos loaded:', todos)
  },
  onError: (error) => {
    console.error('Error loading todos:', error)
  }
})
```

### React Integration

#### Basic Usage
```typescript
import { useStore, useStoreSelector, useEffectStore } from 'zeft/react'

function TodoList() {
  // Get the entire state
  const state = useStore(todoStore)
  
  // Or select specific parts
  const todos = useStoreSelector(todoStore, state => state.todos)
  
  // Use with custom equality function
  const completedTodos = useStoreSelector(
    todoStore,
    state => state.todos.filter(t => t.completed),
    (a, b) => a.length === b.length && a.every((t, i) => t.id === b[i].id)
  )
}
```

#### Using Effects in React
```typescript
import { useEffectStore, useMemoizedAction } from 'zeft/react'

function TodoList() {
  const [state, runEffect] = useEffectStore(todoStore)
  
  const fetchTodos = useMemoizedAction(async () => {
    await runEffect(fetchTodosEffect, {
      onSuccess: (todos) => console.log('Todos fetched:', todos)
    })
  }, [])

  return (
    <div>
      <button onClick={fetchTodos}>Fetch Todos</button>
      <ul>
        {state.todos.map(todo => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>
    </div>
  )
}
```

#### Optimized Selectors
```typescript
import { useStoreSelector, useMemoizedSelector } from 'zeft/react'

function TodoList() {
  // Create a memoized selector
  const selectCompletedTodos = useMemoizedSelector(
    (state) => state.todos.filter(todo => todo.completed),
    []
  )
  
  // Use the memoized selector
  const completedTodos = useStoreSelector(todoStore, selectCompletedTodos)
  
  return (
    <ul>
      {completedTodos.map(todo => (
        <li key={todo.id}>{todo.title}</li>
      ))}
    </ul>
  )
}
```

#### Memoized Actions
```typescript
import { useMemoizedAction } from 'zeft/react'

function TodoActions() {
  const toggleTodo = useMemoizedAction(
    (todoId: string) => async () => {
      await runEffect(toggleTodoEffect(todoId))
    },
    []
  )

  return (
    <button onClick={() => toggleTodo('123')}>
      Toggle Todo
    </button>
  )
}
```

#### Advanced Asynchronous Hooks

Zeft provides a set of hooks for more declarative handling of asynchronous operations. Below, each hook is shown with both a traditional React implementation and the improved zeft version for comparison:

##### useAsyncEffect

For handling a single asynchronous Effect with built-in loading and error states:

**Traditional React approach:**
```tsx
import { useState, useEffect, useCallback } from 'react';

function TodoList() {
  const [todos, setTodos] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuted, setIsExecuted] = useState(false);
  
  const fetchTodos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/todos');
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      setTodos(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
      setIsExecuted(true);
    }
  }, []);
  
  // Run immediately when component mounts
  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <button onClick={fetchTodos}>Refresh</button>
      <ul>
        {todos?.map(todo => <li key={todo.id}>{todo.title}</li>)}
      </ul>
    </div>
  );
}
```

**With zeft:**
```tsx
import { useAsyncEffect } from 'zeft/react'
import * as Effect from 'effect/Effect'

// Create an effect
const fetchTodosEffect = Effect.tryPromise({
  try: () => fetch('/api/todos').then(r => r.json()),
  catch: (error) => new Error(`Failed to fetch todos: ${error}`)
});

function TodoList() {
  // Load data with full state management
  const { 
    data: todos,  // The result 
    error,        // Error if any
    isLoading,    // Loading state
    isExecuted,   // Whether effect was executed
    run           // Function to manually run the effect
  } = useAsyncEffect(
    fetchTodosEffect, 
    {
      immediate: true,               // Run immediately when component mounts
      deps: [userId],                // Dependencies array (like useEffect)
      onSuccess: (data) => {},       // Success callback
      onError: (error) => {}         // Error callback
    }
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <button onClick={run}>Refresh</button>
      <ul>
        {todos?.map(todo => <li key={todo.id}>{todo.title}</li>)}
      </ul>
    </div>
  );
}
```

##### useCombinedEffects

For running multiple effects together (in parallel or sequence):

**Traditional React approach:**
```tsx
import { useState, useEffect, useCallback } from 'react';

function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuted, setIsExecuted] = useState(false);
  
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Parallel execution of async operations
      const [users, todos, projects] = await Promise.all([
        fetch('/api/users').then(r => r.json()),
        fetch('/api/todos').then(r => r.json()),
        fetch('/api/projects').then(r => r.json())
      ]);
      
      // For sequential execution, you'd need multiple awaits
      // const users = await fetch('/api/users').then(r => r.json());
      // const todos = await fetch('/api/todos').then(r => r.json());
      // const projects = await fetch('/api/projects').then(r => r.json());
      
      setData([users, todos, projects]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
      setIsExecuted(true);
    }
  }, []);
  
  // Run on component mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  if (isLoading) return <div>Loading dashboard data...</div>;
  
  if (data) {
    const [users, todos, projects] = data;
    return (
      <Dashboard 
        users={users} 
        todos={todos} 
        projects={projects} 
        onRefresh={fetchData}
      />
    );
  }
  
  if (error) return <div>Error: {error.message}</div>;
  
  return null;
}
```

**With zeft:**
```tsx
import { useCombinedEffects } from 'zeft/react'
import * as Effect from 'effect/Effect'

// Create individual effects
const fetchUsersEffect = Effect.tryPromise(() => fetch('/api/users').then(r => r.json()));
const fetchTodosEffect = Effect.tryPromise(() => fetch('/api/todos').then(r => r.json()));
const fetchProjectsEffect = Effect.tryPromise(() => fetch('/api/projects').then(r => r.json()));

function Dashboard() {
  // Run multiple effects in parallel or sequence
  const { 
    data,      // Array of results in same order as effects
    error,     // First error encountered
    isLoading,
    run
  } = useCombinedEffects(
    [fetchUsersEffect, fetchTodosEffect, fetchProjectsEffect],
    {
      executionOrder: 'parallel', // or 'sequence'
      immediate: true,
      onSuccess: ([users, todos, projects]) => {},
      onError: (error) => {}
    }
  );
  
  if (isLoading) return <div>Loading dashboard data...</div>;
  
  if (data) {
    const [users, todos, projects] = data;
    return (
      <Dashboard 
        users={users} 
        todos={todos} 
        projects={projects} 
        onRefresh={run}
      />
    );
  }
  
  if (error) return <div>Error: {error.message}</div>;
  
  return null;
}
```

##### useConditionalEffect

For running effects only when certain conditions are met:

**Traditional React approach:**
```tsx
import { useState, useEffect, useCallback } from 'react';

function UserProfile() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuted, setIsExecuted] = useState(false);
  
  const fetchUserProfile = useCallback(async () => {
    // Don't run if not logged in
    if (!isLoggedIn) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/user/profile');
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
      setIsExecuted(true);
    }
  }, [isLoggedIn]);
  
  // Run effect when isLoggedIn changes
  useEffect(() => {
    if (isLoggedIn) {
      fetchUserProfile();
    }
  }, [isLoggedIn, fetchUserProfile]);
  
  if (!isLoggedIn) {
    return <button onClick={() => setIsLoggedIn(true)}>Log in</button>;
  }
  
  if (isLoading) return <div>Loading profile...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return user ? <UserDetails user={user} /> : null;
}
```

**With zeft:**
```tsx
import { useConditionalEffect } from 'zeft/react'
import * as Effect from 'effect/Effect'

const fetchUserProfileEffect = Effect.tryPromise(() => 
  fetch('/api/user/profile').then(r => r.json())
);

function UserProfile() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  // Only run when condition is true
  const { 
    data: user, 
    error,
    isLoading 
  } = useConditionalEffect(
    fetchUserProfileEffect,
    isLoggedIn,              // Condition
    { immediate: true }      // Options
  );
  
  if (!isLoggedIn) {
    return <button onClick={() => setIsLoggedIn(true)}>Log in</button>;
  }
  
  if (isLoading) return <div>Loading profile...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return user ? <UserDetails user={user} /> : null;
}
```

##### useStoreEffect

For running effects with direct store integration:

**Traditional React approach:**
```tsx
import { useState, useEffect, useCallback } from 'react';
import { todoStore } from './store';

function TodoList() {
  const [todos, setTodos] = useState(todoStore.getState().todos);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Subscribe to store changes
  useEffect(() => {
    const unsubscribe = todoStore.subscribe((state) => {
      setTodos(state.todos);
    });
    return unsubscribe;
  }, []);
  
  const fetchTodos = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/todos');
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      
      // Update the store with fetched data
      todoStore.setState((state) => ({
        ...state,
        todos: data,
        loading: false
      }));
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      // Update store with error
      todoStore.setState((state) => ({
        ...state,
        error,
        loading: false
      }));
      
      setError(error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Initial fetch
  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);
  
  return (
    <div>
      <button onClick={fetchTodos} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Refresh'}
      </button>
      {/* Rest of the component */}
    </div>
  );
}
```

**With zeft:**
```tsx
import { useStoreEffect } from 'zeft/react'
import * as Effect from 'effect/Effect'

const fetchTodosEffect = Effect.tryPromise(() => 
  fetch('/api/todos').then(r => r.json())
);

function TodoList() {
  // Use effect with automatic store updates
  const { 
    data: todos, 
    isLoading, 
    run
  } = useStoreEffect(
    todoStore,             // The store
    fetchTodosEffect,      // The effect
    {
      immediate: true,
      onSuccess: (todos) => {
        // Update store state
        todoStore.setState((state) => ({
          ...state,
          todos,
          loading: false
        }));
      },
      onError: (error) => {
        todoStore.setState((state) => ({
          ...state,
          error,
          loading: false
        }));
      }
    }
  );
  
  return (
    <div>
      <button onClick={run} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Refresh'}
      </button>
      {/* Rest of the component */}
    </div>
  );
}
```

### Basic Usage Example

```typescript
import { createStore } from 'zeft'

interface Todo {
  id: string
  text: string
  done: boolean
}

interface TodoState {
  todos: Todo[]
  loading: boolean
  error: string | null
}

// Create a store with initial state and actions
const useStore = createStore<TodoState>((set, get) => ({
  todos: [],
  loading: false,
  error: null,
  
  // Actions
  addTodo: (text: string) => {
    const newTodo = { id: Date.now().toString(), text, done: false }
    set(state => ({ todos: [...state.todos, newTodo] }))
  },
    
  removeTodo: (id: string) => {
    set(state => ({ 
      todos: state.todos.filter(todo => todo.id !== id) 
    }))
  },
  
  toggleTodo: (id: string) => {
    set(state => ({
      todos: state.todos.map(todo => 
        todo.id === id ? { ...todo, done: !todo.done } : todo
      )
    }))
  }
}))
```

### Store Slices

For larger applications, you can break your store into modular slices to improve code organization and maintainability. This approach helps separate concerns and makes your state management more scalable.

```typescript
import { createSlice, createStore, combineSlices } from 'zeft'

// Define interfaces for each slice
interface UserSlice {
  user: { id: string; name: string } | null;
  setUser: (user: { id: string; name: string } | null) => void;
  isLoggedIn: boolean;
}

interface TodosSlice {
  todos: Array<{ id: string; text: string; completed: boolean }>;
  addTodo: (text: string) => void;
  toggleTodo: (id: string) => void;
}

// Define the complete store type by combining all slice types
type StoreState = UserSlice & TodosSlice;

// Create individual slices
const createUserSlice = <T>() => 
  createSlice<T, UserSlice>((set, get) => ({
    user: null,
    isLoggedIn: false,
    setUser: (user) => set((state) => ({ 
      user, 
      isLoggedIn: user !== null 
    }) as any, false, "setUser")
  }));

const createTodosSlice = <T>() => 
  createSlice<T, TodosSlice>((set, get) => ({
    todos: [],
    addTodo: (text) => set((state) => {
      const newTodo = { 
        id: Math.random().toString(36).substring(2, 9), 
        text, 
        completed: false 
      };
      return { todos: [...(state as any).todos, newTodo] } as any;
    }, false, "addTodo"),
    
    toggleTodo: (id) => set((state) => {
      const todos = (state as any).todos.map((todo: any) => 
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      );
      return { todos } as any;
    }, false, "toggleTodo")
  }));

// Method 1: Create store by spreading slices manually
export const useStore = createStore<StoreState>((set, get) => ({
  ...createUserSlice<StoreState>()(set, get),
  ...createTodosSlice<StoreState>()(set, get)
}));

// Method 2: Create store using combineSlices helper
export const useStore = createStore<StoreState>(
  combineSlices({
    user: createUserSlice<StoreState>(),
    todos: createTodosSlice<StoreState>()
  })
);

// Usage
function example() {
  const { user, todos, addTodo, setUser } = useStore.getState();
  
  // Use the slice actions
  setUser({ id: "1", name: "John Doe" });
  addTodo("Learn about zeft slices");
}
```

#### Benefits of using slices:

- **Modularity**: Each slice can be developed and tested independently
- **Code organization**: Group related state and actions together
- **Team collaboration**: Different team members can work on different slices
- **Reusability**: Slices can be reused across projects or within different stores
- **Maintainability**: Easier to manage large state structures by breaking them into smaller pieces

### Middleware

#### Persist Middleware
The persist middleware allows you to save your store's state to a storage system (such as localStorage or sessionStorage) and rehydrate it on page reload. This implementation uses Effect for robust error handling.

> **Note:** The persist middleware leverages Effect for robust error handling, but you don't need to install Effect separately. It's included as a dependency when you install zeft.

```typescript
import { createStore } from 'zeft'
import { persist, createJSONStorage } from 'zeft/middleware'

interface UserPreferences {
  theme: 'light' | 'dark'
  fontSize: number
  notifications: boolean
}

// Create a store with persistence
const useStore = createStore<UserPreferences>(
  persist(
    (set) => ({
      theme: 'light',
      fontSize: 16,
      notifications: true,
      setTheme: (theme: 'light' | 'dark') => set({ theme }),
      setFontSize: (fontSize: number) => set({ fontSize }),
      toggleNotifications: () => set(state => ({ notifications: !state.notifications })),
    }),
    {
      name: 'user-preferences', // unique name for storage
      storage: createJSONStorage(() => localStorage) // localStorage by default
    }
  )
)
```

##### Configuring Persistence Options

You can customize how persistence works with various options:

```typescript
const useStore = createStore<UserPreferences>(
  persist(
    (set) => ({
      // State and actions
    }),
    {
      name: 'user-preferences',
      storage: createJSONStorage(() => sessionStorage), // Use sessionStorage instead
      partialize: (state) => ({ 
        // Only persist specific parts of the state
        theme: state.theme,
        fontSize: state.fontSize 
        // Exclude notifications from being persisted
      }),
      onRehydrateStorage: (state) => {
        // Called when hydration is complete
        console.log('State has been rehydrated:', state)
      },
      version: 1, // Version for migrations
      migrate: (persistedState, version) => {
        // Handle migrations between versions
        if (version === 0) {
          // Migrate from version 0 schema to version 1
          return {
            ...(persistedState as any),
            // Add new fields or transform existing ones
            fontSize: (persistedState as any).fontSize || 16
          }
        }
        return persistedState as UserPreferences
      }
    }
  )
)
```

##### Custom Storage Adapters with Effect

The persist middleware works with any storage system that implements the `StateStorage` interface. Storage adapters benefit from Effect's robust error handling:

```typescript
import { persist, StateStorage } from 'zeft/middleware'
import * as Effect from 'effect/Effect'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Custom storage for React Native with Effect
const customStorage: StateStorage = {
  getItem: async (name) => {
    return Effect.tryPromise({
      try: async () => await AsyncStorage.getItem(name),
      catch: (e) => {
        console.error('Error retrieving from AsyncStorage:', e)
        return null
      }
    }).pipe(Effect.runPromise)
  },
  setItem: async (name, value) => {
    return Effect.tryPromise({
      try: async () => {
        await AsyncStorage.setItem(name, value)
      },
      catch: (e) => {
        console.error('Error storing in AsyncStorage:', e)
        throw e
      }
    }).pipe(Effect.runPromise)
  },
  removeItem: async (name) => {
    return Effect.tryPromise({
      try: async () => {
        await AsyncStorage.removeItem(name)
      },
      catch: (e) => {
        console.error('Error removing from AsyncStorage:', e)
        throw e
      }
    }).pipe(Effect.runPromise)
  }
}

const useStore = createStore(
  persist(
    // State creator function
    (set) => ({
      /* ... */
    }),
    {
      name: 'settings',
      storage: customStorage
    }
  )
)
```

##### Handling Hydration Status

You can check and respond to the hydration status using the persist API that's automatically added to your store:

```typescript
import { useEffect } from 'react'
import { useStore } from 'zeft/react'

function App() {
  const hasHydrated = useStore(state => state.persist.hasHydrated())
  
  if (!hasHydrated) {
    return <LoadingScreen />
  }
  
  return <MainApp />
}

// Register hydration callbacks
function HydrationListener() {
  useEffect(() => {
    const unsubscribe = useStore.persist.onHydrate((state) => {
      console.log('Hydration started with state:', state)
    })
    
    const unsubFinish = useStore.persist.onFinishHydration(() => {
      console.log('Hydration finished!')
    })
    
    return () => {
      unsubscribe()
      unsubFinish()
    }
  }, [])
  
  return null
}
```

##### Clearing Persisted State

You can manually clear the persisted state from storage:

```typescript
function LogoutButton() {
  const clearStorage = useStore(state => state.persist.clearStorage)
  const resetState = useStore(state => state.resetState)
  
  const handleLogout = () => {
    clearStorage() // Remove from storage
    resetState()   // Reset in-memory state
  }
  
  return <button onClick={handleLogout}>Logout</button>
}
```

#### DevTools Middleware

The DevTools middleware integrates your store with Redux DevTools Extension, enabling powerful debugging capabilities such as time-travel debugging, action tracking, and state inspection.

> **Note:** To use this middleware, you need to install the [Redux DevTools Extension](https://github.com/reduxjs/redux-devtools) for your browser.

```typescript
import { createStore } from 'zeft'
import { devtools } from 'zeft/middleware'

interface CounterState {
  count: number
  increment: () => void
  decrement: () => void
  reset: () => void
}

// Create a store with DevTools integration
const useStore = createStore<CounterState>(
  devtools(
    (set) => ({
      count: 0,
      
      // Adding action names improves the DevTools experience
      increment: () => set(state => ({ count: state.count + 1 }), false, 'increment'),
      decrement: () => set(state => ({ count: state.count - 1 }), false, 'decrement'),
      reset: () => set({ count: 0 }, false, 'reset')
    }),
    {
      name: 'Counter Store', // The name shown in DevTools
      enabled: true // Explicitly enable (default: true in development, false in production)
    }
  )
)
```

##### Configuring DevTools Options

You can customize the DevTools integration with various options:

```typescript
const useStore = createStore<CounterState>(
  devtools(
    (set) => ({
      // State and actions
    }),
    {
      name: 'My Application Store',
      enabled: process.env.NODE_ENV !== 'production', // Disable in production
      maxAge: 30, // Maximum number of actions to keep in history
      anonymousActionType: 'unnamed_action', // Default name for actions without a name
      stateSanitizer: (state) => {
        // Filter out sensitive data before sending to DevTools
        const { password, ...rest } = state
        return rest
      },
      actionSanitizer: (action) => {
        // Filter sensitive data from actions
        if (action.type === 'setCredentials') {
          return { ...action, payload: '***' }
        }
        return action
      }
    }
  )
)
```

##### Using with TypeScript

When using with TypeScript, you'll need to use the third parameter of the `set` function to name your actions:

```typescript
// Action names improve debugging experience in Redux DevTools
increment: () => set(state => ({ count: state.count + 1 }), false, 'increment'),
```

##### Time-Travel Debugging

With DevTools middleware, you can:
- Track all state changes in Redux DevTools
- Jump to any previous state
- Replay actions
- Export and import state history
- Monitor performance

This makes debugging complex state management issues much easier.

## License

MIT 