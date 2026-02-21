import type { PropertyDeclaration } from 'lit';
import type { FeatureConfigEntry, FeatureDefinition, FeatureMeta } from '../types/feature-types.js';

/**
 * Unified metadata symbol for all feature-related metadata.
 * This single symbol holds provide, configure, and featureProperties.
 */
export const FEATURE_META = Symbol('litFeatureMeta');

/**
 * Get or initialize the unified FeatureMeta for a constructor
 */
export function getOrCreateFeatureMeta(ctor: any): FeatureMeta {
  if (!Object.prototype.hasOwnProperty.call(ctor, FEATURE_META)) {
    Object.defineProperty(ctor, FEATURE_META, {
      value: {
        provide: new Map<string, FeatureDefinition>(),
        configure: new Map<string, FeatureConfigEntry | 'disable'>(),
        featureProperties: new Map<string, PropertyDeclaration>()
      },
      writable: false,
      configurable: true,
      enumerable: false
    });
  }
  return (ctor as any)[FEATURE_META];
}

// ============================================================================
// Deprecated: Old array-based metadata (for backward compatibility)
// ============================================================================

/** @deprecated - Use unified FeatureMeta instead */
export type FeatureMetaEntry =
  | {
      kind: 'provide';
      name: string;
      definition: FeatureDefinition;
    }
  | {
      kind: 'configure';
      name: string;
      options: FeatureConfigEntry | 'disable';
    };
