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

## Basic Usage Example

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

## License

MIT 