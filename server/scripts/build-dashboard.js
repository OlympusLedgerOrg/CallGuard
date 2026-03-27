const fs = require("fs");
const path = require("path");
const babel = require("@babel/standalone");

const repoRoot = path.resolve(__dirname, "../..");
const entry = path.join(repoRoot, "callguard-app.jsx");
const outDir = path.join(__dirname, "../public");
const outfile = path.join(outDir, "app.js");

if (!fs.existsSync(entry)) {
  console.error("Missing callguard-app.jsx at repo root.");
  process.exit(1);
}

const source = fs.readFileSync(entry, "utf8");
const result = babel.transform(source, {
  presets: ["react"],
});

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const banner = "/* Auto-generated: npm run build:dashboard */\n";
fs.writeFileSync(outfile, `${banner}${result.code}`, "utf8");
console.log(`✅ Built dashboard bundle → ${outfile}`);
