export type Command = { id: string; title: string; key: string; run(): void };
export type LifecycleProps = {
  windowId?: string;
  title: string;
  dirty(): boolean;
  flush(): Promise<boolean>;
  quit?(): Promise<boolean>;
  commands: readonly Command[];
  onError(message: string): void;
};
