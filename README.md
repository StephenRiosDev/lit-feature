# lit-feature

## Overview
`lit-feature` is a lightweight library designed to enhance the capabilities of the Lit framework. It provides a set of core functionalities, decorators, and utilities for managing features within the Lit ecosystem.

## Installation
To install `lit-feature`, use npm:

```
npm install lit-feature
```

Make sure to also install Lit as a dependency:

```
npm install lit
```

## Usage
After installing the package, you can import the core functionalities and decorators as follows:

```typescript
import { LitCore, LitFeature, configure, provide } from 'lit-feature';
```

## Features
- **Feature Management**: Register and configure features on Lit components.
- **Compositional Base Classes**: Extend `LitCore` and `LitFeature` to build feature-driven components.
- **Decorators**: Utilize decorators for configuring features and providing feature definitions.

## API Reference
- **Core**: `LitCore`, `LitFeature`.
- **Decorators**:
  - `@configure`: Configures features or components.
  - `@provide`: Provides dependencies to features or components.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for more details.