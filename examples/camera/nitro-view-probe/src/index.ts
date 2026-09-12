import { getHostComponent } from 'react-native-nitro-modules';
import type { CompatibilityViewProps, CompatibilityViewMethods } from './CompatibilityView.nitro';
export type { CompatibilityView } from './CompatibilityView.nitro';
export const CompatibilityViewComponent = getHostComponent<CompatibilityViewProps, CompatibilityViewMethods>('CompatibilityView', () => require('../nitrogen/generated/shared/json/CompatibilityViewConfig.json'));
