import React from 'react';
import * as Effect from 'effect/Effect';
import { createEffectStore } from '../../store';
import { 
  useAsyncEffect, 
  useCombinedEffects,
  useConditionalEffect,
  useStoreEffect 
} from '../../react/hooks';

// Define a Todo type
interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

// Define a User type
interface User {
  id: number;
  name: string;
  email: string;
}

// Create some test effects
const fetchTodosEffect = Effect.tryPromise({
  try: () => 
    fetch('https://jsonplaceholder.typicode.com/todos?_limit=5')
      .then(response => response.json()),
  catch: (error) => new Error(`Failed to fetch todos: ${error}`)
});

const fetchUserEffect = Effect.tryPromise({
  try: () => 
    fetch('https://jsonplaceholder.typicode.com/users/1')
      .then(response => response.json()),
  catch: (error) => new Error(`Failed to fetch user: ${error}`)
});

// Create a store
interface AppState {
  todos: Todo[];
  user: User | null;
  isLoading: boolean;
  error: Error | null;
}

const appStore = createEffectStore<AppState>((set) => ({
  todos: [],
  user: null,
  isLoading: false,
  error: null
}));

// Basic AsyncEffect Example
export function AsyncEffectExample() {
  const { data: todos, error, isLoading } = useAsyncEffect<Todo[], Error>(
    fetchTodosEffect,
    { 
      immediate: true,
      onSuccess: (data) => console.log('Todos loaded:', data.length),
      onError: (error) => console.error('Error loading todos:', error.message)
    }
  );

  if (isLoading) return <div>Loading todos...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!todos) return <div>No todos available</div>;

  return (
    <div>
      <h2>Todos (useAsyncEffect)</h2>
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            {todo.completed ? '✅ ' : '❌ '}
            {todo.title}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Combined Effects Example
export function CombinedEffectsExample() {
  const { 
    data, 
    error, 
    isLoading 
  } = useCombinedEffects<any, Error>(
    [fetchTodosEffect, fetchUserEffect],
    { 
      executionOrder: 'parallel',
      immediate: true
    }
  );

  if (isLoading) return <div>Loading data...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return <div>No data available</div>;

  const [todos, user] = data;

  return (
    <div>
      <h2>Combined Data (useCombinedEffects)</h2>
      <div>
        <h3>User</h3>
        <p>Name: {user.name}</p>
        <p>Email: {user.email}</p>
      </div>
      <div>
        <h3>Todos</h3>
        <ul>
          {todos.map((todo: Todo) => (
            <li key={todo.id}>
              {todo.completed ? '✅ ' : '❌ '}
              {todo.title}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Conditional Effect Example
export function ConditionalEffectExample() {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  
  const { 
    data: user, 
    error, 
    isLoading,
    run: fetchUser
  } = useConditionalEffect<User, Error>(
    fetchUserEffect,
    isLoggedIn,
    { immediate: true }
  );

  return (
    <div>
      <h2>Conditional Effect (useConditionalEffect)</h2>
      <div>
        <button 
          onClick={() => setIsLoggedIn(!isLoggedIn)}
        >
          {isLoggedIn ? 'Log Out' : 'Log In'}
        </button>
        
        {isLoggedIn && (
          <button 
            onClick={fetchUser} 
            disabled={isLoading}
          >
            Refresh User
          </button>
        )}
      </div>
      
      {isLoading && <div>Loading user...</div>}
      {error && <div>Error: {error.message}</div>}
      
      {user && (
        <div>
          <h3>User Profile</h3>
          <p>Name: {user.name}</p>
          <p>Email: {user.email}</p>
        </div>
      )}
      
      {!isLoggedIn && (
        <div>Please log in to see user data</div>
      )}
    </div>
  );
}

// Store Effect Example
export function StoreEffectExample() {
  const { 
    data: todos, 
    error, 
    isLoading,
    run: fetchTodos
  } = useStoreEffect<Todo[], Error, AppState>(
    appStore,
    fetchTodosEffect,
    {
      immediate: true,
      onSuccess: (todos) => {
        appStore.setState((state) => ({ 
          ...state,
          todos, 
          isLoading: false, 
          error: null 
        }));
      },
      onError: (error) => {
        appStore.setState((state) => ({ 
          ...state,
          todos: [], 
          isLoading: false, 
          error 
        }));
      }
    }
  );

  return (
    <div>
      <h2>Store Effect (useStoreEffect)</h2>
      <button 
        onClick={fetchTodos} 
        disabled={isLoading}
      >
        Refresh Todos
      </button>
      
      {isLoading && <div>Loading todos...</div>}
      {error && <div>Error: {error.message}</div>}
      
      {todos && todos.length > 0 && (
        <>
          <h3>Todos</h3>
          <ul>
            {todos.map(todo => (
              <li key={todo.id}>
                {todo.completed ? '✅ ' : '❌ '}
                {todo.title}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// Combined Example Component
export default function AsyncHooksExamples() {
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Zeft Async Hooks Examples</h1>
      
      <section style={{ marginBottom: '40px' }}>
        <AsyncEffectExample />
      </section>
      
      <section style={{ marginBottom: '40px' }}>
        <CombinedEffectsExample />
      </section>
      
      <section style={{ marginBottom: '40px' }}>
        <ConditionalEffectExample />
      </section>
      
      <section style={{ marginBottom: '40px' }}>
        <StoreEffectExample />
      </section>
    </div>
  );
} 