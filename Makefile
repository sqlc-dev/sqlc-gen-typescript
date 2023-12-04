.PHONY: generate

generate: examples/plugin.wasm examples/sqlc.yaml
	cd examples && sqlc-dev generate

# https://github.com/bytecodealliance/javy/releases/tag/v1.2.0
examples/plugin.wasm: out.js
	./javy compile out.js -o examples/plugin.wasm

out.js: src/app.ts $(wildcard src/drivers/*.ts) src/gen/plugin/codegen_pb.ts
	npx tsc --noEmit
	npx esbuild --bundle src/app.ts --tree-shaking=true --format=esm --target=es2020 --outfile=out.js

src/gen/plugin/codegen_pb.ts: buf.gen.yaml
	buf generate --template buf.gen.yaml buf.build/sqlc/sqlc --path plugin/