import { readFileSync, writeFileSync } from "node:fs";

const source = readFileSync(new URL("../packages/script-sdk/src/lifecycle.ts", import.meta.url), "utf8");
writeFileSync(new URL("../packages/script-sdk/src/declarations.generated.ts", import.meta.url), "// Generated from lifecycle.ts by scripts/generate-sdk.ts. Do not edit.\nexport const sdkDeclarations = " + JSON.stringify(source) + ";\n");
