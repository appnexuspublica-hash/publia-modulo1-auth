const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const childProcess = require("node:child_process");

function loadTypeScript() {
  try {
    return require("typescript");
  } catch {
    const globalRoot = childProcess.execFileSync("npm", ["root", "-g"], {
      encoding: "utf8",
    }).trim();
    return require(path.join(globalRoot, "typescript"));
  }
}

const ts = loadTypeScript();
const projectRoot = process.cwd();
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (typeof request === "string" && request.startsWith("@/")) {
    request = path.join(projectRoot, "src", request.slice(2));
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = function transpileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      esModuleInterop: true,
      resolveJsonModule: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  module._compile(output, filename);
};

const target = process.argv[2];
if (!target) {
  console.error("Uso: node scripts/run-local-ts.cjs <arquivo.ts>");
  process.exit(1);
}

require(path.resolve(projectRoot, target));
