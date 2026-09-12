import type { HybridView, HybridViewProps, HybridViewMethods } from 'react-native-nitro-modules';
export interface CompatibilityViewProps extends HybridViewProps { label: string; }
export interface CompatibilityViewMethods extends HybridViewMethods { snapshot(): string; }
export type CompatibilityView = HybridView<CompatibilityViewProps, CompatibilityViewMethods, { ios: "swift" }>;
