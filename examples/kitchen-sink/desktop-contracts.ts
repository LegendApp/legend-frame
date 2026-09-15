// Mobile/web have no desktop filesystem contract; Metro selects the desktop files.
export async function runDesktopContracts(_check: (id: string, action: () => Promise<void>) => Promise<void>, _token: string) {}
