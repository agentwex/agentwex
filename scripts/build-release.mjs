import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "js");
const output = resolve(root, "release");
const stagingRoot = await mkdtemp(resolve(tmpdir(), "agentwex-release-"));
const staging = resolve(stagingRoot, "package");

try {
  await cp(source, staging, { recursive: true });
  await cp(resolve(root, "LICENSE"), resolve(staging, "LICENSE"));
  const manifest = JSON.parse(await readFile(resolve(staging, "package.json"), "utf8"));
  const filename = `agentwex-${manifest.version}.tgz`;
  const { stdout } = await execFileAsync("npm", ["pack", "--json"], { cwd: staging });
  const packed = JSON.parse(stdout)[0];
  await mkdir(output, { recursive: true });
  const destination = resolve(output, filename);
  await cp(resolve(staging, packed.filename), destination);
  const bytes = await readFile(destination);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await writeFile(resolve(output, "SHA256SUMS"), `${sha256}  ${filename}\n`);
  await writeFile(resolve(output, "release.json"), `${JSON.stringify({
    package: manifest.name,
    version: manifest.version,
    filename,
    sha256,
    size: bytes.byteLength,
    node: manifest.engines.node,
    dependencies: 0,
    lifecycleScripts: false,
    source: "https://github.com/agentwex/agentwex",
  }, null, 2)}\n`);
  const discoveryPath = resolve(root, "docs", "agent.json");
  const discovery = JSON.parse(await readFile(discoveryPath, "utf8"));
  discovery.distribution = {
    ...discovery.distribution,
    package: manifest.name,
    version: manifest.version,
    filename,
    sha256,
    minimumNodeVersion: manifest.engines.node.replace(/^>=/, ""),
    runtimeDependencies: 0,
    lifecycleScripts: false,
  };
  await writeFile(discoveryPath, `${JSON.stringify(discovery, null, 2)}\n`);
  process.stdout.write(`${filename} ${sha256}\n`);
} finally {
  await rm(stagingRoot, { recursive: true, force: true });
}
