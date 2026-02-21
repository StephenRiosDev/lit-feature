import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'decorators/index': 'src/decorators/index.ts',
    'decorators/provide': 'src/decorators/provide.ts',
    'decorators/configure': 'src/decorators/configure.ts',
    'types/index': 'src/types/index.ts',
    'types/feature-types': 'src/types/feature-types.ts',
    'lit-core': 'src/lit-core.ts',
    'lit-feature': 'src/lit-feature.ts'
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  bundle: true,
  target: 'es2020',
  external: ['lit', 'lodash.merge'],
  outExtension({ format }) {
    return format === 'esm' ? { js: '.js' } : { js: '.cjs' };
  }
});
