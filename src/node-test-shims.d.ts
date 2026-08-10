declare module "node:child_process" {
  export function execFileSync(command: string, args?: readonly string[]): void;
}

declare module "node:fs" {
  export function mkdtempSync(prefix: string): string;
  export function readFileSync(path: string): Uint8Array;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
}

declare module "node:os" {
  export function tmpdir(): string;
}

declare module "node:path" {
  export function join(...parts: readonly string[]): string;
}

declare module "node:process" {
  export const platform: string;
}
