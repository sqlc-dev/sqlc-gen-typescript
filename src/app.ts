// I cant' get this import to work locally. The import in node_modules is
// javy/dist but esbuild requires the import to be javy/fs
//
// @ts-expect-error
import { readFileSync, writeFileSync, STDIO } from "javy/fs";

import { GenerateRequest, GenerateResponse } from "./gen/plugin/codegen_pb";
import { codegen } from "./codegen";

// Read input from stdin
const input = readInput();
// Call the function with the input
const result = codegen(input);
// Write the result to stdout
writeOutput(result);

// Read input from stdin
function readInput(): GenerateRequest {
  const buffer = readFileSync(STDIO.Stdin);
  return GenerateRequest.fromBinary(buffer);
}

// Write output to stdout
function writeOutput(output: GenerateResponse) {
  const encodedOutput = output.toBinary();
  const buffer = new Uint8Array(encodedOutput);
  writeFileSync(STDIO.Stdout, buffer);
}
