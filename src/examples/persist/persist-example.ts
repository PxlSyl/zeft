import { createStore, createEffectStore } from '../../store';
import { persist, createJSONStorage } from '../../middleware/persist';

// Example with a simple store
interface CounterState {
  count: number;
  increment: () => void;
  decrement: () => void;
}

export const useCounterStore = createStore<CounterState>(
  persist(
    (set, get) => ({
      count: 0,
      increment: () => set(state => ({ count: state.count + 1 })),
      decrement: () => set(state => ({ count: state.count - 1 }))
    }),
    {
      name: 'counter-storage', // unique name in storage
      storage: createJSONStorage(() => localStorage) // using localStorage
    }
  )
);

// Example with an effect store
interface TodoState {
  todos: string[];
  loading: boolean;
  error: string | null;
  addTodo: (todo: string) => void;
  removeTodo: (index: number) => void;
}

export const useTodoStore = createEffectStore<TodoState>(
  persist(
    (set, get) => ({
      todos: [],
      loading: false,
      error: null,
      addTodo: (todo: string) => set(state => ({ 
        todos: [...state.todos, todo] 
      })),
      removeTodo: (index: number) => set(state => ({
        todos: state.todos.filter((_, i) => i !== index)
      }))
    }),
    {
      name: 'todo-storage',
      // Only store the todos and not the loading state
      partialize: (state) => ({ todos: state.todos })
    }
  )
); 