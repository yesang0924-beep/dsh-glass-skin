/**
 * Globals the DSH client module loader provides before `client.js` runs.
 * Keep this file dependency-free: it is the only ambient declaration the
 * type-check gate needs, and it must not ship in the runtime package.
 */
export {};

interface ModuleLoaderDefinition {
  id: string;
  factory(require: (id: string) => any): unknown;
}

declare global {
  interface Window {
    __ModuleLoader__: {
      load(definition: ModuleLoaderDefinition): void;
    };
  }
}
