// I cant' get this import to work locally. The import in node_modules is
// javy/dist but esbuild requires the import to be javy/fs
//
// @ts-expect-error
import { readFileSync, writeFileSync, STDIO } from "javy/fs";

export function log(msg: string) {
  const encoder = new TextEncoder();
  writeFileSync(STDIO.Stderr, encoder.encode(msg));
}
