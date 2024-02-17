import { defineConfig } from 'tsup';

export default defineConfig({
  name: 'tsup',
  platform: 'node',
  target: 'es2022',
  splitting: true,
  skipNodeModulesBundle: true,
  clean: false,
  entry: ['./src/index.ts'],
  format: ['cjs', 'esm'],
  dts: {
    resolve: true,
  },
  treeshake: false,
});
