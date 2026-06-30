import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base = repositoryName ? `/${repositoryName}/` : "/";

export default defineConfig({
  base,
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: ["pyodide"],
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/pyodide/*",
          dest: "pyodide",
        },
      ],
    }),
  ],
  test: {
    environment: "node",
  },
});
