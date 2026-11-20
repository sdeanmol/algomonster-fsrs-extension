/**
 * @file Reusable Method Decorators for Centralized Error Handling & Performance Instrumentation
 * @module decorators/errorDecorators
 * @description Provides standard ECMAScript (Stage 3) and legacy (Stage 2) compatible method decorators:
 * - `@CatchAndLog`: Intercepts sync exceptions and async Promise rejections, logs them via `UIUtils.catchError`,
 *   and supports configurable fallback return or rethrow behavior.
 * - `@CatchAndReturn`: Intercepts errors and returns a strongly-typed fallback value.
 * - `@MeasureTime`: Instruments method duration with `Logger.time` and `Logger.timeEnd` with guaranteed finally cleanup.
 */

import { UIUtils } from '../features/common/utils/uiUtils';
import { Logger } from '../features/common/logger';

/**
 * Options for CatchAndLog decorator.
 */
export interface CatchAndLogOptions<T = unknown> {
    /** Contextual description of the operation (defaults to method name) */
    contextMessage?: string;
    /** If true, rethrows the caught error after logging */
    rethrow?: boolean;
    /** Optional fallback value or resolver function to return when an error is caught */
    fallback?: T | ((err: unknown, ...args: any[]) => T);
    /** Optional metadata key-value pairs merged into the error log */
    metadata?: Record<string, unknown>;
    /** Optional cleanup callback guaranteed to execute after error handling/logging has completed */
    finally?: (this: any, ...args: any[]) => void | Promise<void>;
}

function resolveFallback(fallback: any, err: unknown, args: any[], thisArg?: any): any {
    if (typeof fallback === 'function') {
        try {
            return fallback.call(thisArg, err, ...args);
        } catch {
            return undefined;
        }
    }
    return fallback;
}

/**
 * Method decorator that intercepts synchronous exceptions and asynchronous Promise rejections,
 * logs them using `UIUtils.catchError`, and handles error propagation according to options.
 *
 * Supports both standard ECMAScript (Stage 3) and legacy (Stage 2) decorator environments.
 *
 * @param moduleName - Subsystem or module name for centralized logging (e.g. 'PomodoroTimer')
 * @param messageOrOptions - Contextual message string or full configuration options
 */
export function CatchAndLog(
    moduleName: string,
    messageOrOptions?: string | CatchAndLogOptions
): any {
    const options: CatchAndLogOptions = typeof messageOrOptions === 'string'
        ? { contextMessage: messageOrOptions }
        : (messageOrOptions || {});

    return function (targetOrProto: any, contextOrKey: any, descriptor?: PropertyDescriptor): any {
        // Stage 3 Decorator (ECMAScript Standard)
        if (contextOrKey && typeof contextOrKey === 'object' && contextOrKey.kind === 'method') {
            const methodName = String(contextOrKey.name);
            const contextMessage = options.contextMessage || `Error in ${methodName}`;
            const origMethod = targetOrProto;

            return function (this: any, ...args: any[]) {
                try {
                    const result = origMethod.apply(this, args);
                    if (result && typeof result.then === 'function') {
                        let promise = result.catch((err: unknown) => {
                            UIUtils.catchError(moduleName, contextMessage, err, options.metadata);
                            if (options.rethrow) {
                                throw err;
                            }
                            return resolveFallback(options.fallback, err, args, this);
                        });
                        if (typeof options.finally === 'function') {
                            const cleanupFn = options.finally;
                            promise = promise.finally(() => cleanupFn.apply(this, args));
                        }
                        return promise;
                    }
                    if (typeof options.finally === 'function') {
                        options.finally.apply(this, args);
                    }
                    return result;
                } catch (err: unknown) {
                    try {
                        UIUtils.catchError(moduleName, contextMessage, err, options.metadata);
                        if (options.rethrow) {
                            throw err;
                        }
                        return resolveFallback(options.fallback, err, args, this);
                    } finally {
                        if (typeof options.finally === 'function') {
                            options.finally.apply(this, args);
                        }
                    }
                }
            };
        }

        // Stage 2 Legacy Decorator (TypeScript experimentalDecorators)
        if (typeof contextOrKey === 'string' && descriptor) {
            const methodName = contextOrKey;
            const contextMessage = options.contextMessage || `Error in ${methodName}`;
            const origMethod = descriptor.value;

            descriptor.value = function (this: any, ...args: any[]) {
                try {
                    const result = origMethod.apply(this, args);
                    if (result && typeof result.then === 'function') {
                        let promise = result.catch((err: unknown) => {
                            UIUtils.catchError(moduleName, contextMessage, err, options.metadata);
                            if (options.rethrow) {
                                throw err;
                            }
                            return resolveFallback(options.fallback, err, args, this);
                        });
                        if (typeof options.finally === 'function') {
                            const cleanupFn = options.finally;
                            promise = promise.finally(() => cleanupFn.apply(this, args));
                        }
                        return promise;
                    }
                    if (typeof options.finally === 'function') {
                        options.finally.apply(this, args);
                    }
                    return result;
                } catch (err: unknown) {
                    try {
                        UIUtils.catchError(moduleName, contextMessage, err, options.metadata);
                        if (options.rethrow) {
                            throw err;
                        }
                        return resolveFallback(options.fallback, err, args, this);
                    } finally {
                        if (typeof options.finally === 'function') {
                            options.finally.apply(this, args);
                        }
                    }
                }
            };
            return descriptor;
        }
    };
}

/**
 * Method decorator that intercepts errors and returns a designated fallback value.
 * Preserves method return types while guaranteeing that errors never escape unhandled.
 *
 * @param fallback - Value or resolver function returned if the method throws or rejects
 * @param moduleName - Subsystem or module name for logging
 * @param contextMessage - Optional contextual description of the operation
 */
export function CatchAndReturn<T>(
    fallback: T | ((err: unknown, ...args: any[]) => T),
    moduleName?: string,
    contextMessage?: string
): any {
    return CatchAndLog(moduleName || 'Application', {
        contextMessage,
        fallback,
        rethrow: false
    });
}

/**
 * Method decorator that measures execution duration using `Logger.time` and `Logger.timeEnd`.
 * Safely measures both synchronous and asynchronous Promise-returning methods,
 * guaranteeing timer cleanup in all success and error paths.
 *
 * @param moduleName - Subsystem or module name
 * @param timerLabel - Optional timer identifier (defaults to method name)
 */
export function MeasureTime(
    moduleName: string,
    timerLabel?: string
): any {
    return function (targetOrProto: any, contextOrKey: any, descriptor?: PropertyDescriptor): any {
        // Stage 3 Decorator
        if (contextOrKey && typeof contextOrKey === 'object' && contextOrKey.kind === 'method') {
            const methodName = String(contextOrKey.name);
            const label = timerLabel || methodName;
            const origMethod = targetOrProto;

            return function (this: any, ...args: any[]) {
                Logger.time(moduleName, label);
                try {
                    const result = origMethod.apply(this, args);
                    if (result && typeof result.then === 'function') {
                        return result.finally(() => {
                            Logger.timeEnd(moduleName, label);
                        });
                    }
                    Logger.timeEnd(moduleName, label);
                    return result;
                } catch (err: unknown) {
                    Logger.timeEnd(moduleName, label);
                    throw err;
                }
            };
        }

        // Stage 2 Legacy Decorator
        if (typeof contextOrKey === 'string' && descriptor) {
            const methodName = contextOrKey;
            const label = timerLabel || methodName;
            const origMethod = descriptor.value;

            descriptor.value = function (this: any, ...args: any[]) {
                Logger.time(moduleName, label);
                try {
                    const result = origMethod.apply(this, args);
                    if (result && typeof result.then === 'function') {
                        return result.finally(() => {
                            Logger.timeEnd(moduleName, label);
                        });
                    }
                    Logger.timeEnd(moduleName, label);
                    return result;
                } catch (err: unknown) {
                    Logger.timeEnd(moduleName, label);
                    throw err;
                }
            };
            return descriptor;
        }
    };
}

/**
 * Method decorator that guarantees a cleanup callback executes after method completion,
 * running in a finally block (or .finally() for Promises).
 *
 * When stacked with `@CatchAndLog` (e.g. `@Finally(...) @CatchAndLog(...)`),
 * `@Finally` wraps from the outside, guaranteeing that the error is intercepted and logged first,
 * and the cleanup function executes last.
 *
 * @param cleanupFn - Cleanup callback invoked with `this` context and method arguments
 */
export function Finally<T = any>(
    cleanupFn: (this: T, ...args: any[]) => void | Promise<void>
): any {
    return function (targetOrProto: any, contextOrKey: any, descriptor?: PropertyDescriptor): any {
        // Stage 3 Decorator
        if (contextOrKey && typeof contextOrKey === 'object' && contextOrKey.kind === 'method') {
            const origMethod = targetOrProto;
            return function (this: any, ...args: any[]) {
                try {
                    const result = origMethod.apply(this, args);
                    if (result && typeof result.then === 'function') {
                        return result.finally(() => cleanupFn.apply(this, args));
                    }
                    if (typeof cleanupFn === 'function') {
                        cleanupFn.apply(this, args);
                    }
                    return result;
                } catch (err: unknown) {
                    try {
                        if (typeof cleanupFn === 'function') {
                            cleanupFn.apply(this, args);
                        }
                    } catch {
                        // Suppress cleanup error to allow original error to propagate
                    }
                    throw err;
                }
            };
        }

        // Stage 2 Legacy Decorator
        if (typeof contextOrKey === 'string' && descriptor) {
            const origMethod = descriptor.value;
            descriptor.value = function (this: any, ...args: any[]) {
                try {
                    const result = origMethod.apply(this, args);
                    if (result && typeof result.then === 'function') {
                        return result.finally(() => cleanupFn.apply(this, args));
                    }
                    if (typeof cleanupFn === 'function') {
                        cleanupFn.apply(this, args);
                    }
                    return result;
                } catch (err: unknown) {
                    try {
                        if (typeof cleanupFn === 'function') {
                            cleanupFn.apply(this, args);
                        }
                    } catch {
                        // Suppress cleanup error to allow original error to propagate
                    }
                    throw err;
                }
            };
            return descriptor;
        }
    };
}

/**
 * Higher-order function wrapper that intercepts synchronous exceptions and asynchronous Promise rejections,
 * logs them using `UIUtils.catchError`, and handles error propagation according to options.
 * 
 * Provides the functional counterpart to `@CatchAndLog` for standalone functions, event listeners,
 * and callbacks where class method decorators cannot be applied.
 *
 * @param fn - Target function to wrap
 * @param moduleName - Subsystem or module name for logging
 * @param messageOrOptions - Contextual message string or options
 */
export interface ErrorHandlingOptions extends CatchAndLogOptions {
    context?: string;
    message?: string;
}

export function withErrorHandling<T extends (...args: any[]) => any>(
    fn: T,
    moduleNameOrOptions?: string | ErrorHandlingOptions,
    messageOrOptions?: string | CatchAndLogOptions
): (...args: Parameters<T>) => ReturnType<T> | undefined {
    let moduleName = 'Application';
    let options: CatchAndLogOptions = {};

    if (typeof moduleNameOrOptions === 'string') {
        moduleName = moduleNameOrOptions;
        if (typeof messageOrOptions === 'string') {
            options = { contextMessage: messageOrOptions };
        } else if (messageOrOptions) {
            options = messageOrOptions;
        }
    } else if (moduleNameOrOptions && typeof moduleNameOrOptions === 'object') {
        const opts = moduleNameOrOptions as ErrorHandlingOptions;
        moduleName = opts.context || (opts.metadata?.module as string) || 'Application';
        options = {
            ...opts,
            contextMessage: opts.message || opts.contextMessage
        };
    }

    const contextMessage = options.contextMessage || `Error in ${fn.name || 'anonymous function'}`;

    return function (this: any, ...args: Parameters<T>): any {
        try {
            const result = fn.apply(this, args);
            if (result && typeof result.then === 'function') {
                let promise = result.catch((err: unknown) => {
                    UIUtils.catchError(moduleName, contextMessage, err, options.metadata);
                    if (options.rethrow) {
                        throw err;
                    }
                    return resolveFallback(options.fallback, err, args, this);
                });
                if (typeof options.finally === 'function') {
                    const cleanupFn = options.finally;
                    promise = promise.finally(() => cleanupFn.apply(this, args));
                }
                return promise;
            }
            if (typeof options.finally === 'function') {
                options.finally.apply(this, args);
            }
            return result;
        } catch (err: unknown) {
            try {
                UIUtils.catchError(moduleName, contextMessage, err, options.metadata);
                if (options.rethrow) {
                    throw err;
                }
                return resolveFallback(options.fallback, err, args, this);
            } finally {
                if (typeof options.finally === 'function') {
                    options.finally.apply(this, args);
                }
            }
        }
    };
}

/**
 * Higher-order function wrapper that intercepts errors and returns a designated fallback value.
 *
 * @param fn - Target function to wrap
 * @param fallback - Value returned if the function throws or rejects
 * @param moduleName - Subsystem or module name for logging
 * @param contextMessage - Contextual message
 */
export function withFallback<T extends (...args: any[]) => any, F>(
    fn: T,
    fallback: F,
    moduleName?: string,
    contextMessage?: string
): (...args: Parameters<T>) => ReturnType<T> | F {
    return withErrorHandling(fn, moduleName || 'Application', {
        contextMessage,
        fallback,
        rethrow: false
    }) as any;
}
