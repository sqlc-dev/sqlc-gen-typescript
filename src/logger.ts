import { writeFileSync, STDIO } from "javy/fs";

export function log(msg: string) {
  const encoder = new TextEncoder();
  writeFileSync(STDIO.Stderr, encoder.encode(msg));
}
