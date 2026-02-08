import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    target: 'es2020',
    external: ['react', 'react/jsx-runtime', 'synthtext'],
    outExtension({ format }) {
        return { js: format === "esm" ? ".esm.js" : ".cjs.js" };
    },
})
