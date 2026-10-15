import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION_BINDINGS = [
  ["package.json", ["version"]],
  ["js/package.json", ["version"]],
  [".claude-plugin/plugin.json", ["version"]],
  [".claude-plugin/marketplace.json", ["plugins", 0, "version"]],
  ["gemini-extension.json", ["version"]],
  ["openai-plugin/agentwex/.codex-plugin/plugin.json", ["version"]],
  ["openai-plugin/discovery-evals.json", ["version"]],
  ["docs/agent.json", ["distribution", "version"]],
  ["public/exchange/agent.json", ["distribution", "npmVersion"]],
  ["release/release.json", ["version"]],
  ["public/exchange/release.json", ["version"]],
  ["distribution/publication-status.json", ["releaseVersion"]],
];

const PINNED_INSTALL_PATHS = [
  "README.md",
  "js/README.md",
  "skills/agentwex/SKILL.md",
  "openai-plugin/agentwex/skills/agentwex/SKILL.md",
  "openai-plugin/agentwex/skills/agentwex/references/public-preview.md",
  "openai-plugin/SUBMISSION.md",
  "public/exchange/skill.md",
  "public/llms.txt",
  "public/llms-full.txt",
  "docs/INSTALL.md",
  "app/for-agents/page.tsx",
  "app/exchange/page.tsx",
  "app/exchange/security/page.tsx",
  "src/agentwex/cli.py",
  "js/bin/agentwex.js",
];

const publicationStates = new Set(["prepared", "validated", "submitted", "listed"]);

const readJson = async (root, path) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const writeJson = async (root, path, value) => writeFile(resolve(root, path), `${JSON.stringify(value, null, 2)}\n`);

function valueAt(object, keys) {
  return keys.reduce((value, key) => value?.[key], object);
}

function setValueAt(object, keys, value) {
  const leaf = keys.at(-1);
  const parent = keys.slice(0, -1).reduce((entry, key) => entry[key], object);
  parent[leaf] = value;
}

export async function readReleaseVersion(root) {
  const manifest = await readJson(root, "js/package.json");
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? "")) throw new Error("Invalid canonical release version in js/package.json");
  return manifest.version;
}

export async function synchronizeReleaseMetadata(root, release = null) {
  const version = await readReleaseVersion(root);
  const filename = `agentwex-${version}.tgz`;
  const publication = await readJson(root, "distribution/publication-status.json");
  for (const [path, keys] of VERSION_BINDINGS) {
    const document = await readJson(root, path);
    setValueAt(document, keys, version);
    if (path === "docs/agent.json") {
      document.distribution.filename = filename;
      document.distribution.directPackageUrl = `https://agentwex.xyz/exchange/${filename}`;
      if (release?.sha256) document.distribution.sha256 = release.sha256;
    }
    if (path === "public/exchange/agent.json") {
      document.distribution.directPackageUrl = `https://agentwex.xyz/exchange/${filename}`;
      if (release?.sha256) document.distribution.directPackageSha256 = release.sha256;
      document.agentDiscovery.publicationStatus = structuredClone(publication.channels);
    }
    if (path.endsWith("release.json")) document.filename = filename;
    await writeJson(root, path, document);
  }
  return { version, filename };
}

export async function verifyReleaseMetadata(root) {
  const version = await readReleaseVersion(root);
  const checked = [];
  for (const [path, keys] of VERSION_BINDINGS) {
    const document = await readJson(root, path);
    const actual = valueAt(document, keys);
    if (actual !== version) throw new Error(`Release version drift in ${path}: expected ${version}, received ${actual}`);
    checked.push(path);
  }

  const publication = await readJson(root, "distribution/publication-status.json");
  for (const [channel, entry] of Object.entries(publication.channels ?? {})) {
    if (!publicationStates.has(entry?.status)) throw new Error(`Invalid publication status for ${channel}`);
    if (entry.status === "listed") {
      if (!entry.verifiedAt || Number.isNaN(Date.parse(entry.verifiedAt))) throw new Error(`Listed publication ${channel} requires verifiedAt`);
      try {
        const url = new URL(entry.verificationUrl);
        if (url.protocol !== "https:") throw new Error("https required");
      } catch {
        throw new Error(`Listed publication ${channel} requires an HTTPS verificationUrl`);
      }
    }
  }
  const publicManifest = await readJson(root, "public/exchange/agent.json");
  if (JSON.stringify(publicManifest.agentDiscovery?.publicationStatus) !== JSON.stringify(publication.channels)) {
    throw new Error("Publication status drift in public/exchange/agent.json");
  }

  const pinnedPattern = /agentwex@(\d+\.\d+\.\d+)|Agent WEX node v(\d+\.\d+\.\d+)|agentwex (\d+\.\d+\.\d+)/g;
  for (const path of PINNED_INSTALL_PATHS) {
    const source = await readFile(resolve(root, path), "utf8");
    const versions = [...source.matchAll(pinnedPattern)].map((match) => match[1] ?? match[2] ?? match[3]);
    if (versions.some((candidate) => candidate !== version)) {
      throw new Error(`Pinned install version drift in ${path}: expected ${version}`);
    }
    checked.push(path);
  }
  return { version, checked };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(process.cwd());
  const result = process.argv.includes("--sync")
    ? await synchronizeReleaseMetadata(root)
    : await verifyReleaseMetadata(root);
  process.stdout.write(`${result.version} ${process.argv.includes("--sync") ? "synchronized" : "verified"}\n`);
}
