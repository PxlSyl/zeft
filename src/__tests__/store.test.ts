import { createStore, createEffectStore } from '../store';
import * as Effect from 'effect/Effect';

describe('createStore', () => {
  interface TestState {
    count: number;
    text: string;
  }

  it('should create a store with initial state', () => {
    const store = createStore<TestState>((set, get) => ({
      count: 0,
      text: 'hello'
    }));

    expect(store.getState()).toEqual({ count: 0, text: 'hello' });
  });

  it('should update the state with setState', () => {
    const store = createStore<TestState>((set, get) => ({
      count: 0,
      text: 'hello'
    }));

    store.setState(state => ({ ...state, count: 1 }));
    expect(store.getState()).toEqual({ count: 1, text: 'hello' });
  });

  it('should update the state selectively with setStateSelective', () => {
    const store = createStore<TestState>((set, get) => ({
      count: 0,
      text: 'hello'
    }));

    store.setStateSelective('count', 5);
    expect(store.getState()).toEqual({ count: 5, text: 'hello' });

    store.setStateSelective('text', 'world');
    expect(store.getState()).toEqual({ count: 5, text: 'world' });

    // Using a function
    store.setStateSelective('count', prev => prev + 1);
    expect(store.getState()).toEqual({ count: 6, text: 'world' });
  });

  it('should get state selectively with getStateSelective', () => {
    const store = createStore<TestState>((set, get) => ({
      count: 10,
      text: 'test'
    }));

    expect(store.getStateSelective('count')).toBe(10);
    expect(store.getStateSelective('text')).toBe('test');
  });

  it('should notify subscribers when state changes', () => {
    const store = createStore<TestState>((set, get) => ({
      count: 0,
      text: 'hello'
    }));

    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);

    store.setState(state => ({ ...state, count: 1 }));
    expect(listener).toHaveBeenCalledWith({ count: 1, text: 'hello' });

    unsubscribe();
    store.setState(state => ({ ...state, count: 2 }));
    // Le listener ne doit pas être appelé après unsubscribe
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('createEffectStore', () => {
  interface TestState {
    count: number;
    loading: boolean;
    error: string | null;
  }

  it('should create an effect store with initial state', () => {
    const store = createEffectStore<TestState>((set, get) => ({
      count: 0,
      loading: false,
      error: null
    }));

    expect(store.getState()).toEqual({ count: 0, loading: false, error: null });
  });

  it('should have run method that handles effects', async () => {
    const store = createEffectStore<TestState>((set, get) => ({
      count: 0,
      loading: false,
      error: null
    }));

    const successCallback = jest.fn();
    const errorCallback = jest.fn();

    // Mock Effect.runPromise
    const mockRunPromise = jest.fn().mockResolvedValue('success');
    const runPromiseSpy = jest.spyOn(Effect, 'runPromise').mockImplementation(mockRunPromise);

    // Create a test effect
    const testEffect = Effect.succeed('success') as any;

    // Run the effect
    store.run(testEffect, {
      onSuccess: successCallback,
      onError: errorCallback
    });

    // Validate Effect.runPromise was called
    expect(mockRunPromise).toHaveBeenCalled();

    // Wait for the Promise to resolve
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Check callbacks
    expect(successCallback).toHaveBeenCalledWith('success');
    expect(errorCallback).not.toHaveBeenCalled();

    // Restore the original function
    runPromiseSpy.mockRestore();
  });
}); 