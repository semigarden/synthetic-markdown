import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  root: '.',
  server: {
    port: 4444,
  },

  build: {
    lib: {
      entry: {
        index: path.resolve(__dirname, 'dev/index.ts'),
        react: path.resolve(__dirname, 'react/index.ts'),
      },
      name: 'SyntheticMD',
      fileName: 'synthetic-text.js',
      formats: ['es']
    },
    rollupOptions: {
      external: [],
    },
  },
})
