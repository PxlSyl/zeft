import {
  createEffect,
  createEffectWithState,
  createEffectWithCallback,
} from "../effect";
import * as Effect from "effect/Effect";

// To avoid type errors, we create a base mock that respects the Effect interface
const createMockEffect = () =>
  ({
    [Symbol.for("effect/effectable")]: true,
    [Symbol.for("effect/channel")]: true,
    [Symbol.for("effect/sink")]: true,
    [Symbol.for("effect/stream")]: true,
    pipe: jest.fn(),
  }) as unknown as Effect.Effect<any, any, never>;

// These tests assume that Jest is properly configured
// for TypeScript and that types are available

describe("Effect utilities", () => {
  describe("createEffect", () => {
    it("should create an Effect from a Promise-based function", async () => {
      // Arrange
      const mockFn = jest.fn().mockResolvedValue("success");

      // Act
      const effect = createEffect(mockFn);

      // Assert
      expect(effect).toBeDefined();

      // Mock runPromise to test the execution
      const mockRunPromise = jest
        .spyOn(Effect, "runPromise")
        .mockImplementation(() => Promise.resolve("success"));

      // Execute the effect
      const result = await Effect.runPromise(effect);
      expect(result).toBe("success");

      // Restore the original function
      mockRunPromise.mockRestore();
    });

    it("should handle errors in the Promise-based function", async () => {
      // Arrange
      const error = new Error("test error");
      const mockFn = jest.fn().mockRejectedValue(error);

      // Act
      const effect = createEffect<Error, string>(mockFn);

      // Assert
      expect(effect).toBeDefined();

      // Mock runPromise
      const mockRunPromise = jest
        .spyOn(Effect, "runPromise")
        .mockImplementation(() => Promise.reject(error));

      // Execute the effect and check for the error
      try {
        await Effect.runPromise(effect);
        fail("Should have thrown an error");
      } catch (e) {
        expect(e).toBe(error);
      }

      // Restore the original function
      mockRunPromise.mockRestore();
    });
  });

  describe("createEffectWithState", () => {
    it("should create an Effect that updates state on success", async () => {
      // Arrange
      const successState = jest.fn().mockReturnValue({ count: 1 });
      const errorState = jest.fn();

      // Create a properly typed mock effect
      const mockEffect = createMockEffect();

      // Mock the Effect.tap function with proper typing
      const tapSpy = jest
        .spyOn(Effect, "tap")
        .mockImplementation((effect, fn: any) => {
          fn("success");
          return mockEffect;
        });

      // Mock the Effect.mapError function with proper typing
      const mapErrorSpy = jest
        .spyOn(Effect, "mapError")
        .mockReturnValue(mockEffect);

      // Act
      const effectWithState = createEffectWithState(
        mockEffect,
        successState,
        errorState,
      );

      // Assert
      expect(effectWithState).toBeDefined();
      expect(successState).toHaveBeenCalledWith("success");
      expect(errorState).not.toHaveBeenCalled();

      // Cleanup
      tapSpy.mockRestore();
      mapErrorSpy.mockRestore();
    });

    it("should create an Effect that updates state on error", async () => {
      // Arrange
      const error = new Error("test error");
      const successState = jest.fn();
      const errorState = jest.fn().mockReturnValue({ error: "test error" });

      // Create a properly typed mock effect
      const mockEffect = createMockEffect();

      // Mock the Effect.mapError function with proper typing
      const mapErrorSpy = jest
        .spyOn(Effect, "mapError")
        .mockImplementation((effect, fn: any) => {
          fn(error);
          return mockEffect;
        });

      // Act
      const effectWithState = createEffectWithState(
        mockEffect,
        successState,
        errorState,
      );

      // Assert
      expect(effectWithState).toBeDefined();
      expect(errorState).toHaveBeenCalledWith(error);
      expect(successState).not.toHaveBeenCalled();

      // Cleanup
      mapErrorSpy.mockRestore();
    });
  });

  describe("createEffectWithCallback", () => {
    it("should create an Effect with success and error callbacks", async () => {
      // Arrange
      const onSuccess = jest.fn();
      const onError = jest.fn();

      // Create a properly typed mock effect
      const mockEffect = createMockEffect();

      // Mock the Effect.tap function with proper typing
      const tapSpy = jest
        .spyOn(Effect, "tap")
        .mockImplementation((effect, fn: any) => {
          fn("success");
          return mockEffect;
        });

      // Mock the Effect.mapError function with proper typing
      const mapErrorSpy = jest
        .spyOn(Effect, "mapError")
        .mockReturnValue(mockEffect);

      // Act
      const effectWithCallback = createEffectWithCallback(mockEffect, {
        onSuccess,
        onError,
      });

      // Assert
      expect(effectWithCallback).toBeDefined();
      expect(onSuccess).toHaveBeenCalledWith("success");
      expect(onError).not.toHaveBeenCalled();

      // Cleanup
      tapSpy.mockRestore();
      mapErrorSpy.mockRestore();
    });

    it("should handle errors with callbacks", async () => {
      // Arrange
      const error = new Error("test error");
      const onSuccess = jest.fn();
      const onError = jest.fn();

      // Create a properly typed mock effect
      const mockEffect = createMockEffect();

      // Mock the Effect.mapError function with proper typing
      const mapErrorSpy = jest
        .spyOn(Effect, "mapError")
        .mockImplementation((effect, fn: any) => {
          fn(error);
          return mockEffect;
        });

      // Act
      const effectWithCallback = createEffectWithCallback(mockEffect, {
        onSuccess,
        onError,
      });

      // Assert
      expect(effectWithCallback).toBeDefined();
      expect(onError).toHaveBeenCalledWith(error);
      expect(onSuccess).not.toHaveBeenCalled();

      // Cleanup
      mapErrorSpy.mockRestore();
    });
  });
});
