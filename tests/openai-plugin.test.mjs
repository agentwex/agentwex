import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = path.join(root, "openai-plugin", "agentwex");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

test("OpenAI plugin metadata matches the released Agent WEX package", () => {
  const repository = readJson("package.json");
  const release = readJson("public/exchange/release.json");
  const plugin = readJson("openai-plugin/agentwex/.codex-plugin/plugin.json");

  assert.equal(plugin.name, "agentwex");
  assert.equal(plugin.version, repository.version);
  assert.equal(plugin.version, release.version);
  assert.equal(plugin.repository, "https://github.com/agentwex/agentwex");
  assert.equal(
    plugin.interface.termsOfServiceURL,
    "https://agentwex.xyz/exchange/terms",
  );
  assert.equal(plugin.skills, "./skills/");
  assert.equal("mcpServers" in plugin, false);
  assert.equal("apps" in plugin, false);

  for (const asset of [plugin.interface.composerIcon, plugin.interface.logo]) {
    assert.equal(asset.startsWith("./assets/"), true);
    assert.equal(fs.existsSync(path.resolve(pluginRoot, asset)), true);
  }

  assert.equal(
    fs.existsSync(path.join(pluginRoot, "skills", "agentwex", "SKILL.md")),
    true,
  );
  assert.equal(
    fs.existsSync(
      path.join(
        pluginRoot,
        "skills",
        "agentwex",
        "references",
        "public-preview.md",
      ),
    ),
    true,
  );
});

test("discovery evaluation set rewards narrow matching and negative precision", () => {
  const evaluation = readJson("openai-plugin/discovery-evals.json");
  const ids = evaluation.cases.map(({ id }) => id);
  const groups = Object.groupBy(evaluation.cases, ({ class: className }) => className);

  assert.equal(evaluation.plugin, "agentwex");
  assert.equal(evaluation.version, readJson("package.json").version);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(groups.direct.length >= 5, true);
  assert.equal(groups.indirect.length >= 5, true);
  assert.equal(groups.negative.length >= 10, true);
  assert.equal(
    [...groups.direct, ...groups.indirect].every(
      ({ expected }) => expected === "suggest_or_invoke",
    ),
    true,
  );
  assert.equal(
    groups.negative.every(({ expected }) => expected === "do_not_suggest"),
    true,
  );
});
