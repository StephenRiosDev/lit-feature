import merge from 'lodash.merge';
import type { PropertyDeclaration } from 'lit';
import type {
  FeatureConfigEntry,
  FeatureDefinition,
  FeatureMeta,
  ResolvedFeatures,
  LitCoreConstructor,
  FeatureConfig
} from './types/feature-types.js';
import { FEATURE_META, LIT_CORE_MARKER, LIT_FEATURE_MARKER } from './types/feature-types.js';
import { LitFeature } from './lit-feature.js';
import { getFeaturePropertyMetadata } from './decorators/feature-property.js';
import { DebugUtils } from './debug-utils.js';

// ============================================================================
// Pure Function Module: Feature Resolution
// ============================================================================
// This module contains a single exported function that takes a constructor
// and returns the fully resolved feature state. All inheritance logic lives here.
// ============================================================================

const RESOLVED_CACHE = Symbol('litFeatureResolvedCache');

// ----------------------------------------------------------------------------
// Private Helpers
// ----------------------------------------------------------------------------

/**
 * Get the full inheritance chain from LitCore up to the given constructor.
 * Stops when it encounters a class without the LIT_CORE_MARKER.
 */
function getInheritanceChain(ctor: LitCoreConstructor): LitCoreConstructor[] {
  const chain: LitCoreConstructor[] = [];
  let current: LitCoreConstructor | null = ctor;

  // Walk up the prototype chain until we find a class without the marker
  while (current && (current as any)[LIT_CORE_MARKER]) {
    chain.unshift(current);
    current = Object.getPrototypeOf(current) as LitCoreConstructor | null;
  }

  return chain;
}

/**
 * Merge configuration entries with override semantics
 */
function mergeConfigEntries(
  existing: FeatureConfigEntry | 'disable' | undefined,
  next: FeatureConfigEntry | 'disable'
): FeatureConfigEntry | 'disable' {
  if (next === 'disable') {
    return 'disable';
  }

  if (!existing || existing === 'disable') {
    return { ...next };
  }

  const mergedConfig = merge({}, existing.config || {}, next.config || {});
  const mergedProps: Record<string, PropertyDeclaration | 'disable'> = {
    ...(existing.properties || {})
  };

  Object.entries(next.properties || {}).forEach(([propName, propValue]) => {
    if (propValue === 'disable') {
      delete mergedProps[propName];
    } else {
      mergedProps[propName] = propValue;
    }
  });

  return {
    config: mergedConfig,
    properties: mergedProps
  };
}

function collectFeatureStyles(featureClass: typeof LitFeature): any[] {
  const styles: any[] = [];
  const chain: typeof LitFeature[] = [];
  let current: typeof LitFeature | null = featureClass;

  while (current && (current as any)[LIT_FEATURE_MARKER]) {
    chain.unshift(current);

    if (current === LitFeature) {
      break;
    }

    current = Object.getPrototypeOf(current) as typeof LitFeature | null;
  }

  chain.forEach((featureCtor) => {
    if (featureCtor.styles) {
      if (Array.isArray(featureCtor.styles)) {
        styles.push(...featureCtor.styles);
      } else {
        styles.push(featureCtor.styles);
      }
    }
  });

  return styles;
}

function collectFeatureProperties(featureClass: typeof LitFeature): Record<string, PropertyDeclaration> {
  const properties: Record<string, PropertyDeclaration> = {};
  const chain: typeof LitFeature[] = [];
  let current: typeof LitFeature | null = featureClass;

  while (current && (current as any)[LIT_FEATURE_MARKER]) {
    chain.unshift(current);

    if (current === LitFeature) {
      break;
    }

    current = Object.getPrototypeOf(current) as typeof LitFeature | null;
  }

  chain.forEach((featureCtor) => {
    Object.assign(properties, featureCtor.properties || {});
    const decoratorMeta = getFeaturePropertyMetadata(featureCtor);
    Object.assign(properties, decoratorMeta || {});
  });

  return properties;
}

// ----------------------------------------------------------------------------
// Main Export: Pure Resolution Function
// ----------------------------------------------------------------------------

/**
 * Resolve all features for a component constructor.
 * 
 * This function:
 * 1. Walks the inheritance chain
 * 2. Collects provides and configs from static getters and decorators
 * 3. Merges configurations with proper override semantics
 * 4. Returns final resolved state ready for instantiation
 * 
 * @param ctor - The component constructor
 * @returns Resolved features with properties and feature definitions
 */
export function resolveFeatures(ctor: LitCoreConstructor): ResolvedFeatures {
  const constructorName = ctor.name || 'Unknown';
  DebugUtils.logMeta('resolve-start', `Starting feature resolution for component: ${constructorName}`);

  // Check cache first
  if (Object.prototype.hasOwnProperty.call(ctor, RESOLVED_CACHE)) {
    DebugUtils.logMeta('resolve-cache', `Using cached resolution for: ${constructorName}`);
    return (ctor as unknown as Record<symbol, ResolvedFeatures>)[RESOLVED_CACHE];
  }

  // Collect provides and configs from inheritance chain
  const provides = new Map<string, FeatureDefinition>();
  const configs = new Map<string, FeatureConfigEntry | 'disable'>();

  const chain = getInheritanceChain(ctor);
  DebugUtils.logMeta('resolve-chain', `Inheritance chain for ${constructorName}:`, chain.map(c => c.name));

  chain.forEach(current => {
    const className = current.name || 'Unknown';
    DebugUtils.logMeta('resolve-class', `Processing class: ${className}`);

    // Collect from static getters (provide)
    const staticProvides = current.provide || {};
    Object.entries(staticProvides).forEach(([name, definition]) => {
      DebugUtils.logMeta('resolve-provide-static', `  → Collecting feature: ${name} from static provide`);
      provides.set(name, definition);
    });

    // Collect from static getters (configure)
    const staticConfigs = current.configure || {};
    Object.entries(staticConfigs).forEach(([name, config]) => {
      const nextConfig = config as FeatureConfigEntry | 'disable';
      const merged = mergeConfigEntries(configs.get(name), nextConfig);
      DebugUtils.logMeta('resolve-configure-static', `  → Merging config for feature: ${name}`);
      configs.set(name, merged);
    });

    // Collect from decorators using unified FEATURE_META
    const meta = (current as unknown as Record<symbol, FeatureMeta>)[FEATURE_META];
    if (meta) {
      // Process provides from decorator metadata
      if (meta.provide) {
        meta.provide.forEach((definition, name) => {
          DebugUtils.logMeta('resolve-provide-decorator', `  → Collecting feature: ${name} from decorator`);
          provides.set(name, definition);
        });
      }

      // Process configs from decorator metadata
      if (meta.configure) {
        meta.configure.forEach((config, name) => {
          const merged = mergeConfigEntries(configs.get(name), config);
          DebugUtils.logMeta('resolve-configure-decorator', `  → Merging config for feature: ${name} from decorator`);
          configs.set(name, merged);
        });
      }
    }
  });

  // Build final resolved state
  const resolvedProperties: Record<string, PropertyDeclaration> = {};
  const resolvedStyles: any[] = [];
  const resolvedFeatures = new Map<string, { class: typeof LitFeature; config: FeatureConfig }>();

  DebugUtils.logMeta('resolve-build', `Building resolved state for ${provides.size} provided features`);

  provides.forEach((definition, name) => {
    const featureConfig = configs.get(name);

    // Skip if disabled
    if (featureConfig === 'disable' || definition.enabled === false) {
      DebugUtils.logMeta('resolve-disabled', `  → Skipping disabled feature: ${name}`);
      return;
    }

    DebugUtils.logMeta('resolve-feature', `  → Resolving feature: ${name}`);

    // Collect feature styles from the full inheritance chain
    const featureStyles = collectFeatureStyles(definition.class as unknown as typeof LitFeature);
    if (featureStyles.length > 0) {
      DebugUtils.logMeta(
        'resolve-styles',
        `    → Collecting ${featureStyles.length} style blocks from feature chain: ${name}`
      );
      resolvedStyles.push(...featureStyles);
    }

    // Merge feature properties from the full inheritance chain
    let mergedProperties = collectFeatureProperties(definition.class as unknown as typeof LitFeature);

    // Apply property overrides from config
    if (featureConfig && typeof featureConfig === 'object' && featureConfig.properties) {
      Object.entries(featureConfig.properties).forEach(([propName, propValue]) => {
        if (propValue === 'disable') {
          DebugUtils.logMeta('resolve-property', `    → Disabling property: ${propName}`);
          delete mergedProperties[propName];
        } else {
          DebugUtils.logMeta('resolve-property', `    → Including property: ${propName}`);
          mergedProperties[propName] = propValue;
        }
      });
    }

    // Add to resolved properties
    Object.assign(resolvedProperties, mergedProperties);
    DebugUtils.logMeta('resolve-properties-count', `    → Total properties for ${name}: ${Object.keys(mergedProperties).length}`);

    // Compute final config
    const finalConfig = featureConfig && typeof featureConfig === 'object'
      ? merge({}, definition.config || {}, featureConfig.config || {})
      : (definition.config || {});

    // Add to resolved features
    resolvedFeatures.set(name, {
      class: definition.class as unknown as typeof LitFeature,
      config: finalConfig
    });
  });

  const resolved: ResolvedFeatures = {
    properties: Object.freeze(resolvedProperties),
    styles: resolvedStyles,
    features: resolvedFeatures
  };

  Object.freeze(resolved);

  DebugUtils.logMeta('resolve-complete', `Resolution complete for ${constructorName}`, {
    featuresCount: resolvedFeatures.size,
    propertiesCount: Object.keys(resolvedProperties).length,
    stylesCount: resolvedStyles.length
  });

  // Cache and return
  (ctor as unknown as Record<symbol, ResolvedFeatures>)[RESOLVED_CACHE] = resolved;

  return resolved;
}
