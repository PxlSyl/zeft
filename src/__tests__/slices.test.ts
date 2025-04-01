import { createSlice, createStore, combineSlices } from "../store";

// Test interfaces and types
interface CounterSlice {
  count: number;
  increment: () => void;
  decrement: () => void;
}

interface UserSlice {
  user: { id: string; name: string } | null;
  setUser: (user: { id: string; name: string } | null) => void;
}

type TestStore = CounterSlice & UserSlice;

describe("Slices functionality", () => {
  // Create slice creators
  const createCounterSlice = <T>() =>
    createSlice<T, CounterSlice>((set) => ({
      count: 0,
      increment: () =>
        set(
          (state) => ({ count: (state as any).count + 1 }) as any,
          false,
          "increment",
        ),
      decrement: () =>
        set(
          (state) => ({ count: (state as any).count - 1 }) as any,
          false,
          "decrement",
        ),
    }));

  const createUserSlice = <T>() =>
    createSlice<T, UserSlice>((set) => ({
      user: null,
      setUser: (user) => set({ user } as any, false, "setUser"),
    }));

  it("should create a slice that returns proper state and actions", () => {
    // Test individual slice in isolation
    const mockSet = jest.fn();
    const mockGet = jest.fn(() => ({ count: 5 }));

    const counterSlice = createCounterSlice<{ count: number }>()(
      mockSet,
      mockGet,
    );

    expect(counterSlice.count).toBe(0);
    expect(typeof counterSlice.increment).toBe("function");
    expect(typeof counterSlice.decrement).toBe("function");

    // Test that actions work correctly
    counterSlice.increment();
    expect(mockSet).toHaveBeenCalledWith(
      expect.any(Function),
      false,
      "increment",
    );

    // Test the updater function
    const updaterFn = mockSet.mock.calls[0][0];
    const result = updaterFn({ count: 1 });
    expect(result).toEqual({ count: 2 });
  });

  it("should combine multiple slices using the spread operator method", () => {
    // Create a store with manual slice composition
    const store = createStore<TestStore>((set, get) => ({
      ...createCounterSlice<TestStore>()(set, get),
      ...createUserSlice<TestStore>()(set, get),
    }));

    // Initial state should have properties from both slices
    const state = store.getState();
    expect(state).toEqual(
      expect.objectContaining({
        count: 0,
        user: null,
      }),
    );
    expect(typeof state.increment).toBe("function");
    expect(typeof state.decrement).toBe("function");
    expect(typeof state.setUser).toBe("function");

    // Test counter slice actions
    store.getState().increment();
    expect(store.getState().count).toBe(1);

    store.getState().decrement();
    expect(store.getState().count).toBe(0);

    // Test user slice actions
    const testUser = { id: "1", name: "Test User" };
    store.getState().setUser(testUser);
    expect(store.getState().user).toEqual(testUser);
  });

  it("should combine multiple slices using the combineSlices helper", () => {
    // Create a store with the combineSlices helper
    const store = createStore<TestStore>(
      combineSlices({
        counter: createCounterSlice<TestStore>(),
        user: createUserSlice<TestStore>(),
      }),
    );

    // Initial state should have properties from both slices
    const state = store.getState();
    expect(state).toEqual(
      expect.objectContaining({
        count: 0,
        user: null,
      }),
    );
    expect(typeof state.increment).toBe("function");
    expect(typeof state.decrement).toBe("function");
    expect(typeof state.setUser).toBe("function");

    // Test counter slice actions
    store.getState().increment();
    expect(store.getState().count).toBe(1);

    // Test user slice actions
    const testUser = { id: "1", name: "Test User" };
    store.getState().setUser(testUser);
    expect(store.getState().user).toEqual(testUser);
  });

  it("should allow slices to interact with each other through the shared state", () => {
    // Create a slice that references another slice's state
    const createInteractingSlice = <T extends CounterSlice>() =>
      createSlice<T, { doubleCount: () => void }>((set, get) => ({
        doubleCount: () =>
          set({ count: get().count * 2 } as any, false, "doubleCount"),
      }));

    // Create a store with both slices
    const store = createStore<TestStore & { doubleCount: () => void }>(
      combineSlices({
        base: createCounterSlice<TestStore & { doubleCount: () => void }>(),
        user: createUserSlice<TestStore & { doubleCount: () => void }>(),
        interacting: createInteractingSlice<
          TestStore & { doubleCount: () => void }
        >(),
      }),
    );

    // Set up initial state
    store.getState().increment();
    store.getState().increment();
    expect(store.getState().count).toBe(2);

    // Test interaction between slices
    store.getState().doubleCount();
    expect(store.getState().count).toBe(4);
  });
});
