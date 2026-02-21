/**
 * Type definitions and symbols for the LitFeature system
 */
export type {
  FeatureClass,
  FeatureDefinition,
  FeatureConfigEntry,
  FeatureMeta,
  ResolvedFeatures,
  LitCoreConstructor,
  FeatureConfig
} from './feature-types.js';

// Symbols are internal-only and accessed via Symbol.for() when needed
// They should not be part of the public API
