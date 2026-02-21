/**
 * Performance Monitor
 * 
 * Tracks performance metrics for the component system and logs only when
 * potential issues or slowdowns are detected. Uses harsh thresholds to
 * identify bottlenecks early, assuming the system could scale to 2500+
 * components with multiple features each.
 * 
 * Philosophy: Only log when there's a problem, but be aggressive about
 * what constitutes a "problem" to catch scaling issues early.
 */

interface PerformanceMetrics {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  severity: 'info' | 'warning' | 'error';
  context?: Record<string, unknown>;
}

interface PerformanceThresholds {
  /** Component creation time threshold (ms) - assume 2500 components each taking X ms = total init time */
  componentCreation: number;
  /** Feature initialization time threshold (ms) - features add up across multiple instances */
  featureInit: number;
  /** Render batch time threshold (ms) - rendering many components at once */
  renderBatch: number;
  /** Property reconciliation threshold (ms) - feature property syncing */
  propertyReconciliation: number;
  /** Total initialization time for a component (ms) */
  totalInit: number;
}

class PerformanceMonitor {
  private static readonly instance = new PerformanceMonitor();
  private metrics: PerformanceMetrics[] = [];
  private enabled: boolean = true;
  private verbose: boolean = false;

  // Thresholds - being VERY harsh to catch scaling issues early
  // If we have 2500 components and each takes X ms, total is 2500X
  private thresholds: PerformanceThresholds = {
    componentCreation: 0.5,      // > 0.5ms per component = worry
    featureInit: 0.1,            // > 0.1ms per feature = worry
    renderBatch: 5,              // > 5ms for rendering batch
    propertyReconciliation: 0.2, // > 0.2ms for property syncing
    totalInit: 3                 // > 3ms total to initialize one component
  };

  private marks: Map<string, number> = new Map();

  static getInstance(): PerformanceMonitor {
    return PerformanceMonitor.instance;
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Mark the start of a measured operation
   */
  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  /**
   * Measure from a previous mark and optionally log if threshold exceeded
   */
  measure(
    name: string,
    options?: {
      markStart?: string;
      threshold?: number;
      context?: Record<string, unknown>;
      alwaysLog?: boolean;
    }
  ): number {
    if (!this.enabled) return 0;

    const markStart = options?.markStart || name;
    const startTime = this.marks.get(markStart);

    if (!startTime) {
      this.logWarning(`No start mark found for "${markStart}"`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    const threshold = options?.threshold;

    // Determine if we should log based on threshold and severity
    const shouldLog =
      options?.alwaysLog ||
      (threshold !== undefined && duration > threshold) ||
      this._determineSeverity(name, duration) !== 'info';

    if (shouldLog) {
      const severity = this._determineSeverity(name, duration);
      this._logMetric({
        name,
        startTime,
        endTime,
        duration,
        severity,
        context: options?.context
      });
    }

    // Clean up mark
    this.marks.delete(markStart);

    return duration;
  }

  /**
   * Measure synchronous code execution
   */
  time<T>(
    name: string,
    fn: () => T,
    options?: {
      threshold?: number;
      context?: Record<string, unknown>;
      alwaysLog?: boolean;
    }
  ): { result: T; duration: number } {
    this.mark(name);
    const result = fn();
    const duration = this.measure(name, options);
    return { result, duration };
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Get metrics summary
   */
  getSummary(): {
    total: number;
    warnings: number;
    errors: number;
    avgDuration: number;
    totalDuration: number;
  } {
    const summary = {
      total: this.metrics.length,
      warnings: this.metrics.filter((m) => m.severity === 'warning').length,
      errors: this.metrics.filter((m) => m.severity === 'error').length,
      avgDuration: 0,
      totalDuration: 0
    };

    if (this.metrics.length > 0) {
      summary.totalDuration = this.metrics.reduce((sum, m) => sum + (m.duration || 0), 0);
      summary.avgDuration = summary.totalDuration / this.metrics.length;
    }

    return summary;
  }

  /**
   * Log performance summary to console
   */
  logSummary(): void {
    if (!this.enabled) return;

    const summary = this.getSummary();
    console.group('📊 Performance Summary');
    console.log(`Total Measurements: ${summary.total}`);
    console.log(`⚠️  Warnings: ${summary.warnings}`);
    console.log(`❌ Errors: ${summary.errors}`);
    console.log(`Average Duration: ${summary.avgDuration.toFixed(3)}ms`);
    console.log(`Total Duration: ${summary.totalDuration.toFixed(3)}ms`);

    if (summary.warnings > 0 || summary.errors > 0) {
      console.group('Issues Found:');
      const issues = this.metrics.filter((m) => m.severity !== 'info');
      issues.forEach((metric) => {
        const icon = metric.severity === 'error' ? '❌' : '⚠️';
        console.log(
          `${icon} ${metric.name}: ${metric.duration?.toFixed(3)}ms`,
          metric.context || ''
        );
      });
      console.groupEnd();
    }

    console.groupEnd();
  }

  /**
   * Determine severity based on metric type and duration
   */
  private _determineSeverity(name: string, duration: number): 'info' | 'warning' | 'error' {
    let threshold = 0;
    let errorMultiplier = 2;

    if (name.includes('component-creation')) {
      threshold = this.thresholds.componentCreation;
    } else if (name.includes('feature-init')) {
      threshold = this.thresholds.featureInit;
    } else if (name.includes('render')) {
      threshold = this.thresholds.renderBatch;
    } else if (name.includes('property') || name.includes('reconciliation')) {
      threshold = this.thresholds.propertyReconciliation;
    } else if (name.includes('total-init') || name.includes('total')) {
      threshold = this.thresholds.totalInit;
    } else {
      return 'info';
    }

    if (duration > threshold * errorMultiplier) {
      return 'error';
    } else if (duration > threshold) {
      return 'warning';
    }

    return 'info';
  }

  /**
   * Internal metric logging
   */
  private _logMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    if (this.verbose || metric.severity !== 'info') {
      const icon = metric.severity === 'error' ? '❌' : metric.severity === 'warning' ? '⚠️' : 'ℹ️';
      const contextStr = metric.context
        ? ` ${JSON.stringify(metric.context)}`
        : '';
      console.log(
        `${icon} [${metric.duration?.toFixed(3)}ms] ${metric.name}${contextStr}`
      );
    }
  }

  private logWarning(message: string): void {
    console.warn(`⚠️ PerformanceMonitor: ${message}`);
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();
