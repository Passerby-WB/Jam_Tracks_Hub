const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");

test("pins the minimal private Vue and Vite foundation", () => {
  const packageJson = JSON.parse(read("package.json"));

  assert.equal(packageJson.name, "jam-tracks-hub");
  assert.equal(packageJson.version, "2.0.5");
  assert.equal(packageJson.private, true);
  assert.equal(packageJson.engines.node, ">=22.12.0");
  assert.deepEqual(packageJson.dependencies, { vue: "3.5.42" });
  assert.deepEqual(packageJson.devDependencies, {
    "@vitejs/plugin-vue": "6.0.8",
    playwright: "1.63.0",
    vite: "8.2.2"
  });

  ["vue-router", "pinia", "@vueuse/core", "vue-i18n", "vitest", "@vue/test-utils"].forEach(name => {
    assert.equal(packageJson.dependencies?.[name], undefined);
    assert.equal(packageJson.devDependencies?.[name], undefined);
  });
});

test("uses a non-production Vue entry and a strangler-compatible Vite build", () => {
  const config = read("vite.config.mjs");
  const entry = read("src/entries/vue-foundation.js");
  const component = read("src/foundation/FoundationSmoke.vue");
  const build = read("tools/scripts/build-cloudflare.js");

  assert.match(config, /base:\s*"\/"/);
  assert.match(config, /publicDir:\s*false/);
  assert.match(config, /outDir:\s*"dist"/);
  assert.match(config, /emptyOutDir:\s*true/);
  assert.match(config, /assetsDir:\s*"assets\/vue"/);
  assert.match(config, /preserveEntrySignatures:\s*"strict"/);
  assert.match(config, /src\/entries\/vue-foundation\.js/);
  assert.match(entry, /createApp\(FoundationSmoke\)/);
  assert.doesNotMatch(entry + component, /\.mount\s*\(|document\.|window\./);
  assert.match(build, /Preserved Vite-owned HTML entry/);
  assert.doesNotMatch(build, /rmSync\(dist/);
});

test("does not mount or reference the Vue foundation from production HTML", () => {
  const htmlFiles = fs.readdirSync(root)
    .filter(fileName => fileName.endsWith(".html"));

  assert.ok(htmlFiles.length > 0);
  htmlFiles.forEach(fileName => {
    const html = read(fileName);
    assert.doesNotMatch(html, /vue-foundation|src\/entries\/vue-foundation/i, fileName);
  });
});

test("uses the verified Node 22 contract in local and CI configuration", () => {
  assert.equal(read(".nvmrc").trim(), "22.23.2");
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /node-version:\s*22\.23\.2/);
  assert.match(ci, /run:\s*npm ci/);
});
