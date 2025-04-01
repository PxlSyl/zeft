import { StateCreator, SetState, GetState } from "../store";
import * as Effect from "effect/Effect";

/**
 * Redux DevTools Extension options
 * @see https://github.com/reduxjs/redux-devtools/blob/main/extension/docs/API/Arguments.md
 */
export interface DevtoolsOptions {
  /**
   * The instance name to be shown on the Redux DevTools Extension
   */
  name?: string;

  /**
   * Whether to enable the Redux DevTools Extension
   * Defaults to true in development and false in production
   */
  enabled?: boolean;

  /**
   * The action type to be used for anonymous actions
   * @default "anonymous"
   */
  anonymousActionType?: string;

  /**
   * Custom identifier for the store in the Redux DevTools
   */
  store?: string;

  /**
   * Maximum number of actions to be stored in the history
   * @default 50
   */
  maxAge?: number;

  /**
   * Function to map the state that is sent to Redux DevTools
   * Useful to exclude large objects that could slow down your app
   */
  stateSanitizer?: (state: unknown) => unknown;

  /**
   * Function to map actions that are sent to Redux DevTools
   * Useful to exclude sensitive data from actions
   */
  actionSanitizer?: (action: unknown) => unknown;
}

/**
 * A wrapper type for the Redux DevTools Extension connection
 */
interface DevToolsConnection {
  /**
   * Sends an action and the current state to the DevTools extension
   */
  send: (action: string | { type: string }, state: unknown) => void;

  /**
   * Subscribes to the DevTools time travel events
   */
  subscribe: (listener: (message: any) => void) => () => void;

  /**
   * Initializes the DevTools with the initial state
   */
  init: (state: unknown) => void;

  /**
   * Creates a custom action to be displayed in the DevTools
   */
  action: (name: string, payload?: unknown) => void;
}

/**
 * Check if the Redux DevTools Extension is available
 */
const hasDevTools = () =>
  typeof window !== "undefined" && (window as any).__REDUX_DEVTOOLS_EXTENSION__;

/**
 * Creates a connection to the Redux DevTools Extension
 * @param options DevTools options
 * @returns DevTools connection
 */
function createDevToolsConnection(
  options: DevtoolsOptions,
): DevToolsConnection | null {
  if (!hasDevTools()) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "Redux DevTools Extension is not installed. You can install it from: https://github.com/reduxjs/redux-devtools",
      );
    }
    return null;
  }

  try {
    return Effect.try({
      try: () => {
        const connection = (window as any).__REDUX_DEVTOOLS_EXTENSION__.connect(
          {
            name: options.name || "zeft Store",
            anonymousActionType: options.anonymousActionType || "anonymous",
            maxAge: options.maxAge || 50,
            stateSanitizer: options.stateSanitizer,
            actionSanitizer: options.actionSanitizer,
            features: {
              jump: true,
              skip: true,
              reorder: true,
              dispatch: true,
              persist: true,
            },
          },
        );

        return connection;
      },
      catch: (error) => {
        console.error("Failed to connect to Redux DevTools Extension:", error);
        return null;
      },
    }).pipe(Effect.runSync);
  } catch (error) {
    console.error("Error initializing Redux DevTools Extension:", error);
    return null;
  }
}

/**
 * DevTools middleware for zeft
 *
 * This middleware adds Redux DevTools integration to your store, enabling
 * time-travel debugging and action tracking.
 *
 * @template T Type of the state
 * @param stateCreator Original state creator function
 * @param options DevTools configuration options
 * @returns Enhanced state creator function with DevTools integration
 *
 * @example
 * ```ts
 * // Basic usage
 * const useStore = create(
 *   devtools(
 *     (set) => ({
 *       count: 0,
 *       increment: () => set(state => ({ count: state.count + 1 }), undefined, 'increment'),
 *       decrement: () => set(state => ({ count: state.count - 1 }), undefined, 'decrement'),
 *       reset: () => set({ count: 0 }, undefined, 'reset')
 *     }),
 *     { name: 'Count Store' }
 *   )
 * );
 * ```
 */
export const devtools = <T extends object>(
  stateCreator: StateCreator<T>,
  options: DevtoolsOptions = {},
): StateCreator<T> => {
  // Set default options
  const devtoolsOptions: DevtoolsOptions = {
    name: "zeft Store",
    enabled: process.env.NODE_ENV !== "production",
    anonymousActionType: "anonymous",
    ...options,
  };

  // Do not enable DevTools in production unless explicitly enabled
  if (devtoolsOptions.enabled === false) {
    return stateCreator;
  }

  return (set: SetState<T>, get: GetState<T>) => {
    // Initialize connection to Redux DevTools Extension
    const connection = createDevToolsConnection(devtoolsOptions);

    // Override set function to also update DevTools
    // We need to use 'any' here because of the complexity in the SetState type
    const devtoolsSet = (
      stateOrFn: any,
      replace?: boolean,
      actionName?: string,
    ) => {
      // Default action name for DevTools
      const nextActionName = actionName || devtoolsOptions.anonymousActionType;

      // Call original set function
      set(stateOrFn, replace);

      // Update DevTools with new state
      if (connection) {
        const newState = get();
        connection.send({ type: nextActionName as string }, newState);
      }
    };

    // Create state with overridden set function
    const state = stateCreator(devtoolsSet as SetState<T>, get);

    // Initial state setup for DevTools
    if (connection) {
      connection.init(state);

      // Subscribe to DevTools time-travel events
      connection.subscribe((message: any) => {
        if (message.type === "DISPATCH" && message.state) {
          // Handle time-travel debugging
          if (
            message.payload?.type === "JUMP_TO_ACTION" ||
            message.payload?.type === "JUMP_TO_STATE"
          ) {
            try {
              // Parse the state from DevTools
              const newState = JSON.parse(message.state);

              // Update the state with the historical state from DevTools
              // We use replace=true to completely replace the state
              set(newState as T, true);
            } catch (error) {
              console.error(
                "Failed to parse state from Redux DevTools:",
                error,
              );
            }
          }
        }
      });
    }

    return state;
  };
};
