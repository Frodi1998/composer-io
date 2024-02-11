import { defineConfig } from 'tsup';

export default defineConfig({
  name: 'tsup',
  target: 'node14',
  splitting: true,
  entry: ['./src/index.ts'],
  format: ['cjs', 'esm'],
  dts: {
    resolve: true,
  },
});
