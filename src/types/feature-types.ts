import type { LitCore } from '../lit-core.js';
import type { LitFeature, FeatureConfig, FeatureProperties } from '../lit-feature.js';
import type { PropertyDeclaration, CSSResultGroup } from 'lit';

/**
 * Type for a feature class constructor
 */
export interface FeatureClass<TConfig extends FeatureConfig = FeatureConfig> {
  new (host: LitCore, config: TConfig): LitFeature<TConfig>;
  properties?: FeatureProperties;
  styles?: CSSResultGroup;
}

/**
 * Feature definition as provided in `static get provide()` or decorators
 */
export interface FeatureDefinition<TConfig extends FeatureConfig = FeatureConfig> {
  class: FeatureClass<TConfig>;
  config?: TConfig;
  enabled?: boolean;
}

/**
 * Feature configuration entry for overrides
 */
export interface FeatureConfigEntry {
  config?: FeatureConfig;
  properties?: Record<string, PropertyDeclaration | 'disable'>;
}

// ============================================================================
// CORE CONCEPT #1: Class-Level Metadata (raw decorators)
// ============================================================================

/**
 * Class-level metadata attached to components via decorators or static getters.
 * This is the raw, unresolved state before inheritance merging.
 */
export interface FeatureMeta {
  provide?: Map<string, FeatureDefinition>;
  configure?: Map<string, FeatureConfigEntry | 'disable'>;
  featureProperties?: Map<string, PropertyDeclaration>;
}

// ============================================================================
// CORE CONCEPT #2: Resolved Snapshot (final merged state)
// ============================================================================

/**
 * Final resolved state after merging inheritance chain.
 * This is the only thing FeatureManager needs.
 */
export interface ResolvedFeatures {
  /** All properties from all enabled features */
  properties: Record<string, PropertyDeclaration>;
  /** All styles from all enabled features */
  styles: CSSResultGroup[];
  /** All enabled features with their final config */
  features: Map<string, {
    class: typeof LitFeature;
    config: FeatureConfig;
  }>;
}

/**
 * Interface for LitCore constructor with static feature methods
 */
export interface LitCoreConstructor {
  new (): LitCore;
  name: string;
  provide?: Record<string, FeatureDefinition>;
  configure?: Record<string, FeatureConfigEntry | 'disable'>;
  properties?: Record<string, PropertyDeclaration>;
}

// Re-export FeatureConfig for convenience
export type { FeatureConfig } from '../lit-feature.js';
