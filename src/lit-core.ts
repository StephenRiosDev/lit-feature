import { LitElement, PropertyDeclaration } from 'lit';
import { FeatureManager } from './services/feature-manager.js';
import { resolveFeatures } from './feature-resolver.js';
import { performanceMonitor } from './performance-monitor.js';
import { LIT_CORE_MARKER, FeatureConfigEntry, FeatureDefinition, LitCoreConstructor } from './types/feature-types.js';

/**
 * Symbol to mark classes that extend LitCore.
 * Used by the resolver to detect when to stop walking the inheritance chain.
 * Exported for re-export compatibility and clarity.
 */
export { LIT_CORE_MARKER };

/**
 * Base class for web components with feature management capabilities.
 * Provides a feature system that allows components to inherit, configure, and extend
 * functionality through a composable architecture.
 */
export class LitCore extends LitElement {
  /**
   * Instance of the FeatureManager that handles feature registration,
   * lifecycle management, and property merging.
   */
  featureManager: FeatureManager;

  /**
   * Marker to identify LitCore-based classes
   */
  static readonly [LIT_CORE_MARKER] = true;

  /**
   * Lit reactive properties for this class.
   * We keep this in sync with feature snapshots in `finalize()`.
   */
  static properties: Record<string, PropertyDeclaration> = {};

  constructor() {
    const markName = `lt-core-constructor-${Date.now()}-${Math.random()}`;
    performanceMonitor.mark(markName);
    
    super();
    this.featureManager = new FeatureManager(this, this.constructor as LitCoreConstructor);
    
    const componentName = this.constructor.name || 'UnknownComponent';
    performanceMonitor.measure(`component-creation-${componentName}`, {
      markStart: markName,
      threshold: 0.5,
      context: { component: componentName }
    });
  }

  /**
   * Lit's class finalization hook.
   * We override this to merge feature properties and styles into the class.
   */
  static finalize(): boolean {
    const ctor = this as unknown as LitCoreConstructor;
    const resolved = resolveFeatures(ctor);

    // Merge feature properties
    const superProps = (Object.getPrototypeOf(this) as typeof LitElement)?.properties || {};
    const ownProps = Object.prototype.hasOwnProperty.call(this, 'properties') ? this.properties : {};

    (this as unknown as { properties: Record<string, PropertyDeclaration> }).properties = {
      ...superProps,
      ...resolved.properties,
      ...ownProps
    };

    // Merge feature styles BEFORE calling super.finalize()
    const superStyles = (Object.getPrototypeOf(this) as typeof LitElement)?.styles;
    // Check if this class directly defines styles (not inherited)
    const hasOwnStyles = Object.getOwnPropertyDescriptor(this, 'styles') !== undefined;
    const ownStyles = hasOwnStyles ? this.styles : undefined;

    // Build flat array of styles
    const allStyles = [];
    
    // Handle superStyles - could be single CSSResult or array
    if (superStyles) {
      if (Array.isArray(superStyles)) {
        allStyles.push(...superStyles);
      } else {
        allStyles.push(superStyles);
      }
    }
    
    // Add feature styles
    if (resolved.styles.length > 0) {
      allStyles.push(...resolved.styles);
    }
    
    // Handle ownStyles - could be single CSSResult or array
    if (ownStyles) {
      if (Array.isArray(ownStyles)) {
        allStyles.push(...ownStyles);
      } else {
        allStyles.push(ownStyles);
      }
    }
    
    // Set the static styles property on the class (not instance)
    // This must be done before calling super.finalize() which processes styles
    if (allStyles.length > 0) {
      (this as any).styles = allStyles.length === 1 ? allStyles[0] : allStyles;
    }

    super.finalize();

    return true;
  }


  /**
   * Configuration for features this component wants to use.
   * Use 'disable' property to explicitly disable an inherited feature.
   */
  static configure: Record<string, FeatureConfigEntry | 'disable'>;

  /**
   * Registry of features provided by this component/class.
   * Each feature should include a class reference and optional default configuration.
   */
  static provide: Record<string, FeatureDefinition>;

  /**
   * Registers the component as a custom element with the browser.
   * Also resolves feature metadata for the class.
   */
  static register(componentName: string): void {
    const ctor = this as unknown as LitCoreConstructor;

    resolveFeatures(ctor);
    customElements.define(componentName, ctor as unknown as CustomElementConstructor);
  }

  connectedCallback(): void {
    this.featureManager.processLifecycle('beforeConnectedCallback');
    super.connectedCallback();
    this.featureManager.processLifecycle('connectedCallback');
    this.featureManager.processLifecycle('afterConnectedCallback');
  }

  disconnectedCallback(): void {
    this.featureManager.processLifecycle('beforeDisconnectedCallback');
    this.featureManager.processLifecycle('disconnectedCallback');
    super.disconnectedCallback();
    this.featureManager.processLifecycle('afterDisconnectedCallback');
  }

  firstUpdated(changedProperties: Map<PropertyKey, unknown>): void {
    this.featureManager.processLifecycle('beforeFirstUpdated', changedProperties);
    super.firstUpdated(changedProperties);
    this.featureManager.processLifecycle('firstUpdated', changedProperties);
    this.featureManager.processLifecycle('afterFirstUpdated', changedProperties);
  }

  updated(changedProperties: Map<PropertyKey, unknown>): void {
    this.featureManager.processLifecycle('beforeUpdated', changedProperties);
    super.updated(changedProperties);
    this.featureManager.processLifecycle('updated', changedProperties);
    this.featureManager.processLifecycle('afterUpdated', changedProperties);
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    this.featureManager.processLifecycle('beforeAttributeChangedCallback', name, oldValue, newValue);
    super.attributeChangedCallback(name, oldValue, newValue);
    this.featureManager.processLifecycle('attributeChangedCallback', name, oldValue, newValue);
    this.featureManager.processLifecycle('afterAttributeChangedCallback', name, oldValue, newValue);
  }
}
