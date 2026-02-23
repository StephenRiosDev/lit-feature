import type { PropertyDeclaration } from 'lit';
import { FEATURE_META } from '../types/feature-types.js';
import { getOrCreateFeatureMeta } from './feature-meta.js';

/**
 * Decorator for defining reactive properties on feature classes.
 * Works like Lit's @property but stores metadata in the unified FEATURE_META symbol.
 * 
 * @example
 * ```typescript
 * export class MyFeature extends LitFeature {
 *   @featureProperty({ type: String, reflect: true })
 *   myProp = 'default';
 * }
 * ```
 */
export function property(options: PropertyDeclaration = {}) {
  return function (target: any, propertyKey: string) {
    // For field decorators, target is the prototype
    const ctor = target.constructor;

    // 1. Store in unified FEATURE_META for resolver
    const meta = getOrCreateFeatureMeta(ctor);
    meta.featureProperties!.set(propertyKey, options);
    
    // 2. ALSO add to the feature class's own static properties
    //    This is needed for _litFeatureInit() to create the property proxy
    const parentProperties = ctor.properties || {}; // Get inherited or empty
    if (!Object.prototype.hasOwnProperty.call(ctor, 'properties')) {
      Object.defineProperty(ctor, 'properties', {
        value: {...parentProperties},
        writable: true,
        configurable: true,
        enumerable: false
      });
    }
    
    ctor.properties[propertyKey] = options;
  };
}

/**
 * Extract @featureProperty metadata from a feature class
 */
export function getFeaturePropertyMetadata(ctor: any): Record<string, PropertyDeclaration> {
  const meta = (ctor as any)[FEATURE_META];
  if (!meta || !meta.featureProperties) {
    return {};
  }
  
  const result: Record<string, PropertyDeclaration> = {};
  meta.featureProperties.forEach((value: PropertyDeclaration, key: string) => {
    result[key] = value;
  });
  return result;
}