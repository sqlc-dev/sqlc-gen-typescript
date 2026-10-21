// Stands in for javy's fs module when the code generator runs under Node in
// tests; only the logger writes through it.
export const STDIO = { Stdin: 0, Stdout: 1, Stderr: 2 };

export function readFileSync(fd: number): Uint8Array {
  throw new Error(`readFileSync(${fd}) is not available in tests`);
}

export function writeFileSync(fd: number, buffer: Uint8Array) {
  if (fd === STDIO.Stderr) {
    process.stderr.write(buffer);
  }
}
