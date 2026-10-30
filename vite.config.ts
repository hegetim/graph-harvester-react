/* SPDX-FileCopyrightText: NONE
 * SPDX-License-Identifier: CC0-1.0
 */

import { defineConfig, esmExternalRequirePlugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from "path"
import dts from "vite-plugin-dts"
import { libInjectCss } from "vite-plugin-lib-inject-css"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    dts({ tsconfigPath: './tsconfig.app.json', bundleTypes: true }),
    libInjectCss(),
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
      external: [/^react(?:\/.*)?$/, /^react-dom(?:\/.*)?$/],
      output: {
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
