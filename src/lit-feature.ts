import type { LitCore } from './lit-core';
import type { CSSResult, CSSResultGroup, PropertyDeclaration } from 'lit';
import type { ReactiveController } from 'lit';
import { DebugUtils } from './debug-utils.js';
import { performanceMonitor } from './performance-monitor.js';
import { LIT_FEATURE_MARKER } from './types/feature-types.js';

/**
 * Base interface for feature configuration objects
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FeatureConfig {}

/**
 * Property definitions for a feature
 */
export interface FeatureProperties {
  [key: string]: PropertyDeclaration;
}

/**
 * Base class for all features in the system.
 * Features extend this class to add functionality to LitCore components.
 */
export { LIT_FEATURE_MARKER };

export abstract class LitFeature<TConfig extends FeatureConfig = FeatureConfig> implements ReactiveController {
  static readonly [LIT_FEATURE_MARKER] = true;

  host: LitCore;
  config: TConfig;
  
  private _propertyObservers: Map<string, unknown> = new Map();
  private _internalValues: Map<string, unknown> = new Map();
  private _declaredProperties: Set<string> = new Set();
  private _suspendUpdates: boolean = false;

  /**
   * Static property definitions for this feature.
   * Override in subclasses to define reactive properties.
   */
  static properties: FeatureProperties = {};

  static styles?: CSSResult | CSSResultGroup | undefined;

  constructor(host: LitCore, config: TConfig) {
    const markName = `feature-constructor-${Date.now()}-${Math.random()}`;
    performanceMonitor.mark(markName);
    
    const featureName = this.constructor.name || 'UnnamedFeature';
    const hostName = host.constructor.name || 'UnknownHost';
    DebugUtils.logProperties('feature-constructor', `Constructing ${featureName} on host ${hostName}`);

    this.host = host;
    this.config = config;

    // Register as a controller so we get host lifecycle callbacks
    (this.host as any).addController?.(this);

    this._litFeatureInit();
    
    performanceMonitor.measure(`feature-init-${featureName}`, {
      markStart: markName,
      threshold: 0.1,
      context: { feature: featureName, host: hostName }
    });
  }

  private _litFeatureInit(): void {
    const featureName = this.constructor.name || 'UnnamedFeature';
    DebugUtils.logProperties('feature-init', `Initializing ${featureName} - setting up property observers`);

    const {properties} = (this.constructor as typeof LitFeature);
    if (!properties) {
      DebugUtils.logProperties('feature-init-no-props', `  → ${featureName} has no properties to observe`);
      return;
    }

    const propNames = Object.keys(properties);
    DebugUtils.logProperties('feature-init-props-count', `  → ${featureName} has ${propNames.length} properties`, propNames);

    // Track declared properties for this feature (used during reconciliation)
    propNames.forEach(propName => {
      this._declaredProperties.add(propName);
    });

    // At construction time we only define proxy accessors on the feature.
    // Actual value reconciliation (host ↔ feature) happens in firstUpdated/updated
    // when the host has finished its own setup.
    Object.keys(properties).forEach(propertyName => {
      DebugUtils.logProperties('feature-init-observer', `    → Creating property observer for: ${propertyName}`);
      this._createPropertyObserver(propertyName);
    });
  }

  private _createPropertyObserver(propertyName: string): void {
    const featureName = this.constructor.name || 'UnnamedFeature';
    DebugUtils.logProperties('property-observer-create', `Creating property descriptor for ${featureName}.${propertyName}`);

    const markName = `property-observer-${featureName}-${propertyName}-${Date.now()}-${Math.random()}`;
    performanceMonitor.mark(markName);

    const feature = this;
    Object.defineProperty(this, propertyName, {
      configurable: true,
      enumerable: true,
      get() {
        const value = feature.getInternalValue(propertyName);
        DebugUtils.logWiring('property-getter', `Getting ${featureName}.${propertyName}`, value);
        return value;
      },
      set(newValue: unknown) {
        const setMarkName = `property-set-${featureName}-${propertyName}-${Date.now()}-${Math.random()}`;
        performanceMonitor.mark(setMarkName);

        const hostRecord = feature.host as unknown as Record<string, unknown>;
        const oldValue = hostRecord[propertyName];
        const internalValue = feature.getInternalValue(propertyName);

        DebugUtils.logWiring('property-setter', `Setting ${featureName}.${propertyName}`, {
          oldValue,
          newValue,
          hostName: feature.host.constructor.name || 'UnknownHost'
        });

        // Guard 1: Check if new value is identical to internal value (already set)
        if (Object.is(internalValue, newValue)) {
          DebugUtils.logWiring('property-setter-guard-internal', `  → Skipping: already equals internal value for ${propertyName}`);
          return;
        }

        // Guard 2: Check if new value is identical to host value (no change needed)
        if (Object.is(oldValue, newValue)) {
          DebugUtils.logWiring('property-setter-guard-host', `  → Skipping: already equals host value for ${propertyName}`);
          // Still mirror to internal for consistency
          feature.setInternalValue(propertyName, newValue);
          return;
        }

        // Feature → host: write to Lit reactive property
        hostRecord[propertyName] = newValue;
        DebugUtils.logWiring('property-to-host', `  → Synced to host property: ${propertyName}`, newValue);

        // Mirror into feature internal map
        feature.setInternalValue(propertyName, newValue);
        DebugUtils.logWiring('property-to-internal', `  → Mirrored to internal storage: ${propertyName}`);

        // Guard 3: Only request update if not suspended
        if (!feature._suspendUpdates && typeof (feature.host as any).requestUpdate === 'function') {
          (feature.host as any).requestUpdate(propertyName, oldValue);
          DebugUtils.logWiring('property-request-update', `  → Requested update for: ${propertyName}`);
        } else if (feature._suspendUpdates) {
          DebugUtils.logWiring('property-request-update-suspended', `  → Update suspended for: ${propertyName}`);
        }

        performanceMonitor.measure(`property-set-${featureName}`, {
          markStart: setMarkName,
          threshold: 0.1,
          context: { property: propertyName }
        });
      }
    });

    performanceMonitor.measure(`property-observer-create-${featureName}`, {
      markStart: markName,
      threshold: 0.05,
      context: { property: propertyName }
    });
  }

  /**
   * Method to set internal value without triggering the setter
   */
  setInternalValue(propertyName: string, value: unknown): void {
    this._internalValues.set(propertyName, value);
  }

  /**
   * Method to get internal value
   */
  getInternalValue(propertyName: string): unknown {
    return this._internalValues.get(propertyName);
  }

  /**
   * Suspend update requests (used during initialization batching)
   */
  _suspendUpdateRequests(): void {
    this._suspendUpdates = true;
  }

  /**
   * Resume update requests (used after initialization batching)
   */
  _resumeUpdateRequests(): void {
    this._suspendUpdates = false;
  }

  /**
   * Called when the host connects (ReactiveController lifecycle)
   */
  hostConnected(): void {
    // Subclasses can override this
  }

  /**
   * Called when the host disconnects (ReactiveController lifecycle)
   */
  hostDisconnected(): void {
    // Subclasses can override this
  }

  /**
   * Called after the host element's first update cycle (legacy hook).
   * Kept for compatibility; you can prefer `hostUpdated` for controller-style usage.
   */
  firstUpdated(_changedProperties?: Map<PropertyKey, unknown>): void {
    const featureName = this.constructor.name || 'UnnamedFeature';
    const hostName = this.host.constructor.name || 'UnknownHost';
    
    DebugUtils.logWiring('first-updated-start', `First update phase for ${featureName} (host: ${hostName})`);

    const featureRecord = this as unknown as Record<string, unknown>;
    const hostRecord = this.host as unknown as Record<string, unknown>;

    // Only reconcile properties declared by this feature (not all changed properties)
    this._declaredProperties.forEach(propertyName => {
      const hostValue = hostRecord[propertyName];
      const internalValue = this.getInternalValue(propertyName);

      DebugUtils.logWiring('first-updated-reconcile', `Reconciling property: ${propertyName}`, {
        hostValue,
        internalValue
      });

      if (hostValue !== undefined) {
        // Host value exists - but only re-set if it differs from internal value
        if (!Object.is(hostValue, internalValue)) {
          DebugUtils.logWiring('first-updated-host-wins', `  → Host value wins for ${propertyName}`);
          (featureRecord as any)[propertyName] = hostValue;
        } else {
          DebugUtils.logWiring('first-updated-host-match', `  → Host value already matches internal for ${propertyName}`);
          // Just ensure internal is set
          this.setInternalValue(propertyName, hostValue);
        }
      } else if (internalValue !== undefined) {
        // Feature default exists and host doesn't - push it out
        DebugUtils.logWiring('first-updated-feature-wins', `  → Feature default wins for ${propertyName}`, internalValue);
        (featureRecord as any)[propertyName] = internalValue;
      } else {
        // Nothing set anywhere; just mirror undefined for consistency
        DebugUtils.logWiring('first-updated-mirror', `  → No value set, mirroring undefined for ${propertyName}`);
        this.setInternalValue(propertyName, hostValue);
      }
    });

    DebugUtils.logWiring('first-updated-complete', `First update phase complete for ${featureName}`);
  }

  /**
   * Called after the host element updates.
   * Sync host → feature only for properties that actually changed.
   */
  updated(changedProperties: Map<PropertyKey, unknown>): void {
    const featureName = this.constructor.name || 'UnnamedFeature';
    const hostName = this.host.constructor.name || 'UnknownHost';

    DebugUtils.logWiring('updated-start', `Update phase for ${featureName} (host: ${hostName})`);

    const hostRecord = this.host as unknown as Record<string, unknown>;

    changedProperties.forEach((_oldValue, propertyName) => {
      const newValue = hostRecord[propertyName as string];
      DebugUtils.logWiring('updated-sync', `Syncing changed property: ${propertyName as string}`, newValue);
      this.setInternalValue(propertyName as string, newValue);
    });

    DebugUtils.logWiring('updated-complete', `Update phase complete for ${featureName}`);
  }

  // Lifecycle hooks that can be overridden by subclasses
  connectedCallback?(): void;
  disconnectedCallback?(): void;
  beforeConnectedCallback?(): void;
  afterConnectedCallback?(): void;
  beforeDisconnectedCallback?(): void;
  afterDisconnectedCallback?(): void;
  beforeFirstUpdated?(changedProperties: Map<PropertyKey, unknown>): void;
  afterFirstUpdated?(changedProperties: Map<PropertyKey, unknown>): void;
  beforeUpdated?(changedProperties: Map<PropertyKey, unknown>): void;
  afterUpdated?(changedProperties: Map<PropertyKey, unknown>): void;
  beforeAttributeChangedCallback?(name: string, oldValue: string | null, newValue: string | null): void;
  attributeChangedCallback?(name: string, oldValue: string | null, newValue: string | null): void;
  afterAttributeChangedCallback?(name: string, oldValue: string | null, newValue: string | null): void;
}
