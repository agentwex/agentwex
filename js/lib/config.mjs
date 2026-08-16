import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

export function defaultConfigPath() {
  return process.env.AWE_CONFIG_PATH ? resolve(process.env.AWE_CONFIG_PATH) : resolve(homedir(), ".awe", "config.json");
}

export function statePathFor(configPath) {
  return resolve(dirname(configPath), "state.json");
}

export function validateBaseUrl(value) {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("Agent WEX exchange URL must use HTTPS (HTTP is allowed only for localhost)");
  }
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export async function readConfig(configPath = defaultConfigPath()) {
  const parsed = JSON.parse(await readFile(configPath, "utf8"));
  if (parsed?.schema !== "minority-prophet.awe-node-config.v0.1" || !parsed.apiKey || !parsed.agentId || !parsed.collector?.token) {
    throw new Error(`Invalid Agent WEX node configuration: ${configPath}`);
  }
  parsed.baseUrl = validateBaseUrl(parsed.baseUrl);
  return parsed;
}

export async function writePrivateText(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, value, { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, path);
  await chmod(path, 0o600);
}

export async function writePrivateJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, path);
  await chmod(path, 0o600);
}

export async function readState(configPath = defaultConfigPath()) {
  try {
    const state = JSON.parse(await readFile(statePathFor(configPath), "utf8"));
    return state?.schema === "minority-prophet.awe-node-state.v0.1" ? state : null;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function writeState(configPath, state) {
  await writePrivateJson(statePathFor(configPath), {
    schema: "minority-prophet.awe-node-state.v0.1",
    pendingContributions: [],
    queries: [],
    routes: [],
    creditBalance: 0,
    ...state,
    updatedAt: new Date().toISOString(),
  });
}
