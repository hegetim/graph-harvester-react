/* SPDX-FileCopyrightText: NONE
 * SPDX-License-Identifier: CC0-1.0
 */

import { defineConfig, esmExternalRequirePlugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from "path"
import { readFileSync } from 'node:fs'
import dts from "vite-plugin-dts"
import { libInjectCss } from "vite-plugin-lib-inject-css"

// https://vite.dev/config/
export default defineConfig({
  // Emit worker URLs relative to the library chunk, including under subpaths.
  base: './',
  plugins: [
    react(),
    dts({ tsconfigPath: './tsconfig.app.json', bundleTypes: true }),
    libInjectCss(),
    {
      name: 'include-pdfjs-license',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'PDFJS-LICENSE.txt',
          source: readFileSync(resolve(import.meta.dirname, 'node_modules/pdfjs-dist/LICENSE')) })
      },
    },
    esmExternalRequirePlugin({ external: ['react', /^node:/] }),
  ],
  build: {
    // do not copy the contents of the public folder to the dist folder
    copyPublicDir: false,
    lib: {
      // this is the file that exports our components
      entry: resolve(import.meta.dirname, "lib/graph-harvester-react.ts"),
      name: "GraphHarvester",
      fileName: "graph-harvester-react",
      formats: ["es"],
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: [/^react(?:\/.*)?$/, /^react-dom(?:\/.*)?$/, 'kdbush', 'rbush'],
      output: {
        // Some web servers do not assign a JavaScript MIME type to .mjs.
        // This remains the original PDF.js ES module, just with a .js suffix.
        assetFileNames: asset => asset.names.some(name => name.endsWith('pdf.worker.mjs'))
          ? 'pdf.worker.js'
          : '[name][extname]',
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
