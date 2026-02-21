import type { FeatureConfig, FeatureDefinition } from '../types/feature-types.js';
import { getOrCreateFeatureMeta } from './feature-meta.js';

/**
 * Type for the feature definition value passed to @provide decorator
 */
export type ProvideDefinition<TConfig extends FeatureConfig = FeatureConfig> = FeatureDefinition<TConfig>;

/**
 * Class decorator that registers a feature in the provides registry.
 * 
 * @param featureName - The name the feature will be attached as on the component instance
 * @param definition - The feature class and optional configuration
 * 
 * @example
 * ```typescript
 * @provide('Layout', { class: LayoutFeature, config: { layout: 'condensed' } })
 * @provide('Counter', { class: CounterFeature })
 * class MyComponent extends LitCore {
 *   // this.Layout and this.Counter will be available at runtime
 * }
 * ```
 */
export function provide<TConfig extends FeatureConfig = FeatureConfig>(
  featureName: string,
  definition: FeatureDefinition<TConfig>
) {
  return function <T extends { new (...args: unknown[]): object }>(constructor: T): T {
    const meta = getOrCreateFeatureMeta(constructor);
    meta.provide!.set(featureName, definition as unknown as FeatureDefinition);

    return constructor;
  };
}
