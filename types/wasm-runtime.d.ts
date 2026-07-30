declare module '@napi-rs/wasm-runtime' {
    export function getDefaultContext(): unknown;
    export function instantiateNapiModuleSync(
        wasmBinary: ArrayBuffer,
        options: {
            context: unknown;
            asyncWorkPoolSize?: number;
            wasi?: unknown;
            plugins?: unknown[];
            onCreateWorker?: unknown;
            overwriteImports?: (importObject: any) => any;
            beforeInit?: (options: { instance: WebAssembly.Instance }) => void;
        }
    ): { napiModule: { exports: any }; instance: WebAssembly.Instance };
    export class WASI {
        constructor(options?: { version?: string });
    }
    export const emnapiAsyncWorkPlugin: unknown;
    export const emnapiTSFNPlugin: unknown;
}

declare module '*.wasm' {
    const content: string;
    export default content;
}

