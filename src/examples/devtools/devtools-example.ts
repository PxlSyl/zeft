import { createStore } from "../../store";
import { devtools } from "../../middleware/devtools";

/**
 * Example interface for a counter store
 */
interface CounterState {
  count: number;
  lastOperation: string;
  increment: (amount?: number) => void;
  decrement: (amount?: number) => void;
  reset: () => void;
}

/**
 * Create a store with DevTools integration
 *
 * This example demonstrates how to use the devtools middleware to enable
 * time-travel debugging and state inspection with Redux DevTools.
 *
 * To use this example:
 * 1. Install Redux DevTools browser extension
 * 2. Run your application
 * 3. Open Redux DevTools and select "zeft Counter" from the store selector
 * 4. Dispatch actions and observe state changes
 * 5. Try time-traveling by clicking on previous actions
 */
const useCounterStore = createStore<CounterState>(
  devtools(
    (set, get) => ({
      count: 0,
      lastOperation: "none",

      // Each action includes a name for better DevTools integration
      increment: (amount = 1) => {
        set(
          (state) => ({
            count: state.count + amount,
            lastOperation: `increment(${amount})`,
          }),
          false,
          "increment",
        );
      },

      decrement: (amount = 1) => {
        set(
          (state) => ({
            count: state.count - amount,
            lastOperation: `decrement(${amount})`,
          }),
          false,
          "decrement",
        );
      },

      reset: () => {
        set({ count: 0, lastOperation: "reset" }, false, "reset");
      },
    }),
    {
      name: "zeft Counter", // Name shown in DevTools
      enabled: true, // Explicitly enable DevTools
      maxAge: 25, // Limit history size
    },
  ),
);

// Example usage in a React component
//
// function Counter() {
//   const { count, increment, decrement, reset } = useCounterStore();
//
//   return (
//     <div>
//       <h1>Count: {count}</h1>
//       <button onClick={() => increment()}>+1</button>
//       <button onClick={() => increment(5)}>+5</button>
//       <button onClick={() => decrement()}>-1</button>
//       <button onClick={() => decrement(5)}>-5</button>
//       <button onClick={reset}>Reset</button>
//     </div>
//   );
// }

export default useCounterStore;
