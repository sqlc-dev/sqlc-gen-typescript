import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

export async function loadGenerator() {
  const result = await build({
    stdin: {
      contents: 'export { codegen } from "./src/app"; export * from "./src/gen/plugin/codegen_pb";',
      loader: "ts",
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    logLevel: "silent",
    plugins: [{
      name: "test-generator",
      setup(builder) {
        // Expose the generator only in tests; the production entry point keeps
        // its existing Javy stdin/stdout interface.
        builder.onLoad({ filter: /\/src\/app\.ts$/ }, async ({ path }) => ({
          contents: await readFile(path, "utf8") + "\nexport { codegen };\n",
          loader: "ts",
          resolveDir: dirname(path),
        }));
        builder.onResolve({ filter: /^javy\/fs$/ }, () => ({ path: "javy/fs", namespace: "test" }));
        builder.onLoad({ filter: /.*/, namespace: "test" }, () => ({
          contents: `
            import { GenerateRequest } from "./src/gen/plugin/codegen_pb";
            export const STDIO = { Stdin: 0, Stdout: 1, Stderr: 2 };
            export function readFileSync() {
              return new GenerateRequest({
                pluginOptions: new TextEncoder().encode('{"driver":"pg"}')
              }).toBinary();
            }
            export function writeFileSync() {}
          `,
          loader: "ts",
          resolveDir: root,
        }));
        builder.onResolve({ filter: /^(typescript|@bufbuild\/protobuf)$/ }, ({ path }) => ({
          path: import.meta.resolve(path),
          external: true,
        }));
      },
    }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
}
