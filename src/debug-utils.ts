/**
 * Debug Utilities for LitFeature System
 * 
 * Provides a centralized debugging system with flags for each phase of the
 * feature lifecycle. Uses sessionStorage for persistence across page reloads,
 * allowing developers to observe the full instantiation lifecycle on page load.
 * 
 * Usage in browser console:
 *   window.__litFeatureDebug.enabled = true;
 *   window.__litFeatureDebug.meta = true;
 *   window.__litFeatureDebug.properties = true;
 *   window.__litFeatureDebug.wiring = true;
 * 
 * Or set flags and reload:
 *   sessionStorage.setItem('__litFeatureDebug', JSON.stringify({ enabled: true }));
 *   location.reload();
 */

/**
 * Global debug configuration object
 */
interface DebugConfig {
  /** Master flag: enables/disables all debugging (takes precedence) */
  enabled: boolean;
  
  /** Debug meta/static gathering during definition phase */
  meta: boolean;
  
  /** Debug property resolution and wiring during instantiation phase */
  properties: boolean;
  
  /** Debug internal wiring between features and host */
  wiring: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace globalThis {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    var __litFeatureDebug: DebugConfig | undefined;
  }
}

/**
 * Default debug configuration - all flags off by default
 */
const DEFAULT_DEBUG_CONFIG: DebugConfig = {
  enabled: false,
  meta: false,
  properties: false,
  wiring: false
};

const SESSION_STORAGE_KEY = '__litFeatureDebug';
let _initialized = false;

/**
 * Initialize debug configuration from sessionStorage or create new
 */
function initializeDebugConfig(): DebugConfig {
  if (_initialized && typeof globalThis !== 'undefined' && globalThis.__litFeatureDebug) {
    return globalThis.__litFeatureDebug;
  }

  let config: DebugConfig = { ...DEFAULT_DEBUG_CONFIG };

  // Try to load from sessionStorage
  if (typeof globalThis !== 'undefined' && globalThis.sessionStorage) {
    try {
      const stored = globalThis.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<DebugConfig>;
        config = { ...DEFAULT_DEBUG_CONFIG, ...parsed };
        // Show that we loaded from storage
        if (config.enabled || config.meta || config.properties || config.wiring) {
          console.warn(
            `[LitFeature Debug] Loaded configuration from sessionStorage. Flags enabled: ${
              [
                config.enabled && 'master',
                config.meta && 'meta',
                config.properties && 'properties',
                config.wiring && 'wiring'
              ]
                .filter(Boolean)
                .join(', ')
            }`
          );
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.__litFeatureDebug = config;
  }

  // Show warning if no flags are enabled
  if (!config.enabled && !config.meta && !config.properties && !config.wiring) {
    console.warn(
      `[LitFeature Debug] Debugging is available but currently disabled.\n` +
      `To enable, set flags in your browser console:\n` +
      `  window.__litFeatureDebug.enabled = true;     // Master flag\n` +
      `  window.__litFeatureDebug.meta = true;        // Definition phase\n` +
      `  window.__litFeatureDebug.properties = true;  // Instantiation phase\n` +
      `  window.__litFeatureDebug.wiring = true;      // Host ↔ Feature sync\n\n` +
      `Or set flags and reload to see the full lifecycle:\n` +
      `  sessionStorage.setItem('__litFeatureDebug', JSON.stringify({ enabled: true }));\n` +
      `  location.reload();`
    );
  }

  _initialized = true;
  return config;
}

/**
 * Get current debug configuration
 */
function getDebugConfig(): DebugConfig {
  if (typeof globalThis === 'undefined' || !globalThis.__litFeatureDebug) {
    return initializeDebugConfig();
  }
  return globalThis.__litFeatureDebug;
}

/**
 * Save current debug configuration to sessionStorage
 */
function saveDebugConfig(config: DebugConfig): void {
  if (typeof globalThis === 'undefined' || !globalThis.sessionStorage) {
    return;
  }

  try {
    globalThis.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    // Ignore storage errors (e.g., quota exceeded)
  }
}

/**
 * Update a debug flag and persist to sessionStorage
 */
function setDebugFlag(flag: keyof DebugConfig, value: boolean): void {
  const config = getDebugConfig();
  config[flag] = value;
  
  if (typeof globalThis !== 'undefined') {
    globalThis.__litFeatureDebug = config;
  }
  
  saveDebugConfig(config);
}

/**
 * Check if a specific debug flag is enabled
 * @param flag - The debug flag to check (meta, properties, wiring)
 * @returns true if either the master 'enabled' flag or the specific flag is true
 */
function isDebugEnabled(flag: keyof Omit<DebugConfig, 'enabled'>): boolean {
  const config = getDebugConfig();
  // Master flag takes precedence - if enabled is true, all logging is on
  return config.enabled === true || config[flag] === true;
}

/**
 * Log message for definition phase (meta/static gathering)
 */
function logMeta(phase: string, message: string, data?: unknown): void {
  if (!isDebugEnabled('meta')) return;
  const prefix = '[LitFeature Debug] [Definition Phase] [Meta]';
  if (data !== undefined) {
    console.log(`${prefix} [${phase}] ${message}`, data);
  } else {
    console.log(`${prefix} [${phase}] ${message}`);
  }
}

/**
 * Log message for instantiation phase (property resolution and wiring)
 */
function logProperties(phase: string, message: string, data?: unknown): void {
  if (!isDebugEnabled('properties')) return;
  const prefix = '[LitFeature Debug] [Instantiation Phase] [Properties]';
  if (data !== undefined) {
    console.log(`${prefix} [${phase}] ${message}`, data);
  } else {
    console.log(`${prefix} [${phase}] ${message}`);
  }
}

/**
 * Log message for internal wiring (feature ↔ host synchronization)
 */
function logWiring(phase: string, message: string, data?: unknown): void {
  if (!isDebugEnabled('wiring')) return;
  const prefix = '[LitFeature Debug] [Wiring Phase] [Internal Sync]';
  if (data !== undefined) {
    console.log(`${prefix} [${phase}] ${message}`, data);
  } else {
    console.log(`${prefix} [${phase}] ${message}`);
  }
}

/**
 * Export debug utilities
 */
export const DebugUtils = {
  initializeDebugConfig,
  getDebugConfig,
  setDebugFlag,
  saveDebugConfig,
  isDebugEnabled,
  logMeta,
  logProperties,
  logWiring
} as const;

// Initialize on module load so configuration is ready from the start
initializeDebugConfig();
