import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    target: 'es2020',
    outExtension({ format }) {
        return { js: format === "esm" ? ".esm.js" : ".cjs.js" };
    },
    esbuildOptions(options) {
        options.loader = {
            ...(options.loader || {}),
            '.css': 'text'
        }
    }
})
