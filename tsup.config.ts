import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src'],
  outDir: 'build',
  format: ['esm'],
  splitting: false,
  sourcemap: true,
  clean: true,
})
