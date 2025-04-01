# Changelog

All notable changes to this project will be documented in this file.

## [0.5.1] - 2025-04-01

### Improved
- Optimized package size by excluding examples from the published package
- Reduced unpacked size from ~183KB to significantly less

## [0.5.0] - 2025-04-01

### Improved
- Enhanced use of Effect in all asynchronous hooks:
  - Replaced try/catch blocks with more functional patterns using `Effect.tap`, `Effect.tapError`, and `Effect.ensuring`
  - Improved error handling with typed errors
  - Better composition of effects
  - More declarative and functional implementation

### Added
- Improved documentation in README with comparison examples showing:
  - Traditional React approach vs. zeft hooks implementation
  - Clear examples of code simplification provided by the library
  - More comprehensive usage examples for all hooks

## [0.4.0] - 2025-04-01

### Added
- Support for slices with `createSlice` and `combineSlices`
- New asynchronous hooks:
  - `useAsyncEffect`: Manages a single asynchronous effect with built-in state
  - `useCombinedEffects`: Combines multiple effects in parallel or sequence
  - `useConditionalEffect`: Runs effects based on conditions
  - `useStoreEffect`: Integrates effects directly with a store
- Examples for all new features

## [0.3.0] - 2025-04-01

### Added
- DevTools middleware for Redux DevTools integration
- Support for time-travel debugging
- Action naming for better debugging
- Documentation for DevTools usage

## [0.2.0] - 2025-04-01

### Added
- Persist middleware for state persistence
- Support for various storage options
- Migration capabilities for versioned storage
- Documentation and examples

## [0.1.0] - 2025-04-01

### Added
- Initial release
- Basic store implementation
- Effect store for async operations
- React integration with optimized hooks
- TypeScript support 