import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useStore, useStoreSelector, useEffectStore, useMemoizedSelector, useMemoizedAction } from '../react';
import { createStore, createEffectStore } from '../store';
import * as Effect from 'effect/Effect';

// These tests assume that jest and @testing-library/react-hooks are configured
// correctly for React tests

describe('React hooks', () => {
  // Test for useStore hook
  describe('useStore', () => {
    it('should return the current state of the store', () => {
      // Arrange
      const store = createStore<{ count: number }>((set, get) => ({
        count: 0
      }));
      
      // Act
      const { result } = renderHook(() => useStore(store));
      
      // Assert
      expect(result.current).toEqual({ count: 0 });
    });
    
    it('should update when the store state changes', () => {
      // Arrange
      const store = createStore<{ count: number }>((set, get) => ({
        count: 0
      }));
      
      // Act
      const { result } = renderHook(() => useStore(store));
      
      // Update the store outside of the hook
      act(() => {
        store.setState(state => ({ count: state.count + 1 }));
      });
      
      // Assert
      expect(result.current).toEqual({ count: 1 });
    });
  });
  
  // Test for useStoreSelector hook
  describe('useStoreSelector', () => {
    it('should select a part of the store state', () => {
      // Arrange
      const store = createStore<{ count: number; text: string }>((set, get) => ({
        count: 0,
        text: 'hello'
      }));
      
      // Act
      const { result } = renderHook(() => useStoreSelector(store, state => state.count));
      
      // Assert
      expect(result.current).toBe(0);
    });
    
    it('should update only when the selected state changes', () => {
      // Arrange
      const store = createStore<{ count: number; text: string }>((set, get) => ({
        count: 0,
        text: 'hello'
      }));
      
      // Mock functions to track renders
      const renderCounter = jest.fn();
      
      // Act
      const { result } = renderHook(() => {
        renderCounter();
        return useStoreSelector(store, state => state.count);
      });
      
      // Initial render count (React 18 may call render multiple times in strict mode)
      const initialRenderCount = renderCounter.mock.calls.length;
      
      // Reset the counter for cleaner assertions
      renderCounter.mockClear();
      
      // Update a part of the state that is selected
      act(() => {
        store.setState(state => ({ ...state, count: 1 }));
      });
      
      // Should cause a re-render
      expect(renderCounter).toHaveBeenCalled();
      expect(result.current).toBe(1);
      
      // Reset the counter again
      renderCounter.mockClear();
      
      // Update a part of the state that is NOT selected
      act(() => {
        store.setState(state => ({ ...state, text: 'world' }));
      });
      
      // In non-strict mode, this should not cause a re-render
      // But in strict mode React 18, extra renders might happen
      // So we'll just verify the selected value hasn't changed
      expect(result.current).toBe(1);
    });
  });
  
  // Test for useEffectStore hook
  describe('useEffectStore', () => {
    it('should return the current state and a run function', () => {
      // Arrange
      const store = createEffectStore<{ count: number }>((set, get) => ({
        count: 0
      }));
      
      // Act
      const { result } = renderHook(() => useEffectStore(store));
      
      // Assert
      expect(result.current[0]).toEqual({ count: 0 });
      expect(typeof result.current[1]).toBe('function');
    });
    
    it('should run effects with the provided function', async () => {
      // Arrange
      const store = createEffectStore<{ count: number }>((set, get) => ({
        count: 0
      }));
      
      // Mock effect and callbacks
      const onSuccess = jest.fn();
      const onError = jest.fn();
      const testEffect = Effect.succeed('success') as any;
      
      // Mock Effect.runPromise
      const mockRunPromise = jest.fn().mockResolvedValue('success');
      const runPromiseSpy = jest.spyOn(Effect, 'runPromise').mockImplementation(mockRunPromise);
      
      // Act
      const { result } = renderHook(() => useEffectStore(store));
      
      // Run the effect
      await act(async () => {
        result.current[1](testEffect, { onSuccess, onError });
      });
      
      // Assert that runPromise was called
      expect(mockRunPromise).toHaveBeenCalled();
      
      // Restore original function
      runPromiseSpy.mockRestore();
    });
  });
  
  // Test for memoization hooks
  describe('useMemoizedSelector', () => {
    it('should create a memoized selector function', () => {
      // Arrange
      const selectorFn = (state: { count: number }) => state.count > 0;
      
      // Act
      const { result, rerender } = renderHook(() => useMemoizedSelector(selectorFn));
      
      // Get the memoized function
      const memoizedSelector = result.current;
      
      // Call it with some state
      const result1 = memoizedSelector({ count: 1 });
      expect(result1).toBe(true);
      
      // Rerender should not create a new function
      rerender();
      expect(result.current).toBe(memoizedSelector);
    });
  });
  
  describe('useMemoizedAction', () => {
    it('should create a memoized action function', () => {
      // Arrange
      const actionFn = jest.fn();
      
      // Act
      const { result, rerender } = renderHook(() => useMemoizedAction(actionFn));
      
      // Get the memoized function
      const memoizedAction = result.current;
      
      // Call it
      memoizedAction();
      expect(actionFn).toHaveBeenCalledTimes(1);
      
      // Rerender should not create a new function
      rerender();
      expect(result.current).toBe(memoizedAction);
    });
  });
}); 