// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react-swc'
// import dts from 'vite-plugin-dts'
// import path from 'path'

// export default defineConfig({
//   plugins: [
//     react(),
//     dts({
//       entryRoot: 'src',
//       outDir: 'dist',
//     }),
//   ],
//   root: '.',
//   server: {
//     port: 4444,
//   },

//   build: {
//     lib: {
//       entry: {
//         index: path.resolve(__dirname, 'src/index.tsx'),
//         react: path.resolve(__dirname, 'src/react/index.ts'),
//       },
//       name: 'SyntheticMD',
//       fileName: 'synthetic-text.js',
//       formats: ['es']
//     },
//     rollupOptions: {
//       external: [],
//     },
//   },
// })

import { defineConfig } from "vite"
import { resolve } from "node:path"
import dts from "vite-plugin-dts"

export default defineConfig({
  plugins: [dts({ entryRoot: "src", outDir: "dist" })],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: () => "synthetic.min.js",
    },
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    minify: "esbuild",
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
})
