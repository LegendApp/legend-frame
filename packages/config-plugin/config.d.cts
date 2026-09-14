export function readConfig(root: string, target?: string): any;
export function prepareConfig(root: string): any;
export function toExpo(value: unknown, target?: string): any;
export function writeUpdates(root: string, updates: unknown): void;

export function isUniversal(root: string): boolean;
export function isExpoProject(root: string): boolean;
export function statePath(root: string, name: string, target?: string): string;
export function selectTarget(platforms: string[], target?: string): string;
export function expoConfig(root: string): any;
