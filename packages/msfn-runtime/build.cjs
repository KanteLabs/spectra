const path = require("path");
const fs = require("fs");
const esbuild = require("esbuild");
const postcss = require("postcss");
const root = path.resolve(__dirname, "../..");
const pkg = require("./package.json");
async function build() {
 fs.mkdirSync(path.join(__dirname, "dist"), {recursive:true});
 const css = postcss.parse(fs.readFileSync(path.join(root,"src/app/globals.css"),"utf8"));
 css.walkAtRules("import", r => r.remove());
 css.walkRules(rule => {
   if (rule.parent.type === "atrule" && /keyframes/.test(rule.parent.name)) return;
   rule.selectors = rule.selectors.map(s => [":root","html","body"].includes(s) ? ".spectra-runtime" : ".spectra-runtime " + s);
 });
 fs.writeFileSync(path.join(__dirname,"dist/runtime.css"), css.toString() + "\n.spectra-runtime {position:absolute;inset:0;width:100%;height:100%;text-align:left;letter-spacing:normal;font-size:16px;}\n.spectra-runtime .app-shell {width:100%;height:100%;}\n");
 const options = {
  entryPoints:[path.join(__dirname,"runtime.tsx")], outfile:path.join(__dirname,"dist/runtime.js"),
  bundle:true, format:"esm", platform:"browser", target:"es2020", jsx:"automatic",
  external:Object.keys(pkg.peerDependencies), tsconfig:path.join(root,"tsconfig.json"),
  banner:{js:'import "./runtime.css";'}, logLevel:"info"
 };
 if (process.argv.includes("--watch")) {
   const context = await esbuild.context(options);
   await context.watch();
 } else await esbuild.build(options);
}
build().catch(e=>{console.error(e);process.exit(1);});
