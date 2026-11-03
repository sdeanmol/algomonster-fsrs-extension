/**
 * @file Ambient Declarations for NAPI WebAssembly Runtime and WASM Modules
 * @module types/wasm-runtime
 * @context Ambient declaration for WebAssembly execution and WASI workers in browser environments
 * @description Provides type declarations for `@napi-rs/wasm-runtime` and `.wasm` asset imports,
 * enabling Rust-compiled FSRS optimizer modules to execute natively in Chrome Extension contexts.
 */

declare module '@napi-rs/wasm-runtime' {
    /**
     * Retrieves the default execution context for NAPI WebAssembly modules.
     * @returns The default runtime context object.
     */
    export function getDefaultContext(): unknown;

    /**
     * Synchronously instantiates a compiled NAPI WebAssembly binary module.
     * @param wasmBinary - Raw ArrayBuffer containing the compiled WebAssembly bytecode.
     * @param options - Configuration options including execution context, WASI environment, and imports.
     * @returns An object containing the instantiated NAPI module exports and WebAssembly instance.
     */
    export function instantiateNapiModuleSync(
        wasmBinary: ArrayBuffer,
        options: {
            /** Runtime execution context instance */
            context: unknown;
            /** Number of worker threads allocated for asynchronous operations */
            asyncWorkPoolSize?: number;
            /** WASI system interface emulation instance */
            wasi?: unknown;
            /** List of NAPI runtime plugins */
            plugins?: unknown[];
            /** Worker creation hook for multithreaded WASI execution */
            onCreateWorker?: unknown;
            /** Optional hook to intercept or override WebAssembly import objects */
            overwriteImports?: (importObject: any) => any;
            /** Initialization callback invoked before module lifecycle startup */
            beforeInit?: (options: { instance: WebAssembly.Instance }) => void;
        }
    ): { napiModule: { exports: any }; instance: WebAssembly.Instance };

    /**
     * WebAssembly System Interface (WASI) implementation for browser sandboxes.
     */
    export class WASI {
        /**
         * Initializes a new WASI environment.
         * @param options - WASI configuration options, including WASI version string.
         */
        constructor(options?: { version?: string });
    }

    /** Plugin supporting asynchronous work pool execution in WebAssembly */
    export const emnapiAsyncWorkPlugin: unknown;

    /** Plugin supporting Thread-Safe Functions (TSFN) across Web Workers */
    export const emnapiTSFNPlugin: unknown;
}

/**
 * Module declaration for Webpack bundled `.wasm` asset URLs.
 */
declare module '*.wasm' {
    /** Asset URL or file path emitted by the Webpack asset loader */
    const content: string;
    export default content;
}
