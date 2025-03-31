// Export of core store features
export {
  createStore,
  createEffectStore,
  type Store,
  type EffectStore,
  type SetState,
  type GetState,
} from "./store";

// Export of effect utilities
export {
  createEffect,
  createEffectWithState,
  createEffectWithCallback,
} from "./effect";

// React hooks are exported from a sub-path to enable tree-shaking
// Users can import them with: import { useStore } from 'zeft/react'

// Middlewares are exported from a sub-path
// Users can import them with: import { persist } from 'zeft/middleware'
