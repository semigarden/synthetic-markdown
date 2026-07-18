import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: false,
    clean: true,
    bundle: true,
    target: 'es2020',
    outExtension({ format }) {
        return { js: format === "esm" ? ".esm.js" : ".cjs.js" };
    },
})
