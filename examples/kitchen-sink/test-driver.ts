export type TestDriver = { call(method: string, args: string): Promise<string> };
export const testDriver: TestDriver | undefined = undefined;
