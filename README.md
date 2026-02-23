# LitFeature

A composable feature system for Lit that enables clean, declarative composition of component behaviors without the complexity of deep mixin stacks.

**Features** are small, single-responsibility units of behavior that can be provided by base classes and configured or disabled by subclasses, while participating in Lit's reactive property system and lifecycle.

## Why LitFeature?

Building large design systems with Lit requires:
- Composing multiple independent behaviors (ripple effects, themes, dismissal logic, etc.)
- Enabling/disabling behaviors per component
- Overriding defaults at different inheritance levels
- Avoiding complex, brittle mixin stacks

LitFeature provides a declarative, inheritance-aware model for composing behaviors that feels natural to Lit developers.

## Installation

```sh
npm install lit-feature
```

## Quick Start

### Using Decorators (Recommended)

```ts
import { LitCore } from 'lit-feature';
import { provide, configure } from 'lit-feature/decorators';
import { RippleFeature } from './features/ripple-feature.js';
import { ThemeFeature } from './features/theme-feature.js';

// Provide features with default configuration
@provide('Ripple', { class: RippleFeature, config: { rippleDurationMs: 600 } })
@provide('Theme', { class: ThemeFeature, config: { variant: 'primary' } })
export class MyButton extends LitCore {
  declare Ripple: RippleFeature;
  declare Theme: ThemeFeature;
}

// Extend and override configuration
@configure('Theme', { config: { variant: 'secondary' } })
export class SecondaryButton extends MyButton {}

// Disable inherited features
@configure('Ripple', 'disable')
export class StaticButton extends MyButton {}
```

### Using Static Properties

```ts
import { LitCore } from 'lit-feature';
import { RippleFeature } from './features/ripple-feature.js';

export class MyButton extends LitCore {
  static provide = {
    Ripple: {
      class: RippleFeature,
      config: { rippleDurationMs: 600 }
    }
  };
}

export class SlowRippleButton extends MyButton {
  static configure = {
    Ripple: {
      config: { rippleDurationMs: 1200 }
    }
  };
}
```

## Creating a Feature

Features extend `LitFeature` and can define reactive properties, lifecycle methods, and styles:

```ts
import { LitFeature } from 'lit-feature';
import { property } from 'lit-feature/decorators';
import { css } from 'lit';

export class RippleFeature extends LitFeature {
  @property({ type: Boolean, reflect: true })
  rippling = false;

  @property({ type: Number, attribute: 'ripple-duration' })
  rippleDurationMs = 600;

  connectedCallback() {
    super.connectedCallback();

    // Host is automatically available in the feature scope
    this.host.addEventListener('click', this.#handleClick);
  }

  #handleClick = (e: MouseEvent) => {
    this.rippling = true;
    setTimeout(() => {
      this.rippling = false;
    }, this.rippleDurationMs);
  };

  static styles = css`
    :host([rippling]) {
      animation: ripple-effect var(--ripple-duration, 600ms) ease-out;
    }
    
    @keyframes ripple-effect {
      0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.6); }
      100% { box-shadow: 0 0 0 20px rgba(255, 255, 255, 0); }
    }
  `;
}
```

## Core Concepts

### Providing Features

Use `@provide(name, definition)` or `static provide` to make features available on a class and its subclasses:

```ts
@provide('MyFeature', { 
  class: MyFeatureClass, 
  config: { /* default config */ } 
})
export class BaseElement extends LitCore {}
```

### Configuring Features

Use `@configure(name, options)` or `static configure` to override inherited feature configuration or disable features:

```ts
// Override configuration
@configure('MyFeature', { config: { /* updated config */ } })
export class CustomElement extends BaseElement {}

// Disable a feature
@configure('MyFeature', 'disable')
export class NoFeatureElement extends BaseElement {}
```

### Feature Inheritance

Features themselves can extend other features, inheriting properties, styles, and lifecycle methods:

```ts
export class BaseDismissFeature extends LitFeature {
  @property({ type: Boolean }) dismissed = false;
  
  dismiss() {
    this.dismissed = true;
  }
}

export class AutoDismissFeature extends BaseDismissFeature {
  @property({ type: Number }) timeout = 3000;
  
  connectedCallback() {
    super.connectedCallback();
    setTimeout(() => this.dismiss(), this.timeout);
  }
}
```

## Available Demo Features

This repository includes example features demonstrating different use cases:

### Visual Effects
- **RippleFeature** - Material Design ripple effect on interaction
- **PulseFeature** - Pulsing animation for attention-grabbing

### Theming
- **ThemeFeature** - Configurable theme variants with CSS custom properties

### Dismissal Patterns
- **BaseDismissFeature** - Core dismissal behavior
- **AutoDismissFeature** - Automatic dismissal after timeout (extends BaseDismiss)
- **SwipeDismissFeature** - Swipe-to-dismiss with gesture tracking (extends AutoDismiss)

## API Reference

### Core Classes

- **`LitCore`** - Base class for components that support features (extends `LitElement`)
- **`LitFeature`** - Base class for creating features
- **`FeatureManager`** - Internal manager for feature instantiation and lifecycle

### Decorators

- **`@provide(name, definition)`** - Declare a feature on a class
- **`@configure(name, options)`** - Configure or disable an inherited feature
- **`@property(options)`** - Re-exported Lit property decorator for use in features

### Lifecycle Methods

Features can implement any of these lifecycle hooks:
- `connectedCallback()` / `disconnectedCallback()`
- `firstUpdated(changedProperties)` / `updated(changedProperties)`
- `attributeChangedCallback(name, oldValue, newValue)`

And "around" hooks:
- `beforeConnectedCallback()` / `afterConnectedCallback()`
- `beforeDisconnectedCallback()` / `afterDisconnectedCallback()`
- `beforeFirstUpdated()` / `afterFirstUpdated()`
- `beforeUpdated()` / `afterUpdated()`
- `beforeAttributeChangedCallback()` / `afterAttributeChangedCallback()`

## Documentation

For detailed documentation, advanced patterns, and interactive examples, visit:

**[https://StephenRiosDev.github.io/LitFeature/#docs](https://StephenRiosDev.github.io/LitFeature/#docs)**

## Dependencies

- `lit` - The Lit library
- `lodash.merge` - Deep merging for configuration

## Relationship to Lit Concepts

- **Mixins** - Great for small numbers of behaviors, but complex at scale
- **Reactive Controllers** - Strong composition primitive; LitFeature extends this pattern with inheritance-aware configuration and declarative property contribution
- **Context** - Solves dependency injection; LitFeature focuses on behavior composition and lifecycle

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.

If you reuse or redistribute this code, please retain the [NOTICE](NOTICE) file to preserve attribution.

## Contributing

This is an early proof-of-concept exploring compositional patterns for Lit. Feedback and contributions are welcome!

For questions, issues, or feature requests, please visit the [GitHub repository](https://github.com/StephenRiosDev/LitFeature).
