import { defineConfig } from 'tsup';

export default defineConfig({
  name: 'tsup',
  platform: 'node',
  target: 'esnext',
  splitting: true,
  skipNodeModulesBundle: true,
  clean: true,
  entry: ['./src/index.ts'],
  format: ['cjs', 'esm'],
  terserOptions: {
    mangle: false,
    keep_classnames: true,
    keep_fnames: true,
  },
  dts: {
    resolve: true,
  },
  treeshake: false,
});
