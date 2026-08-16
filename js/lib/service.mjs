import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const label = "org.minorityprophet.awe-node";

function xml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export async function installBackgroundService({ binPath, configPath }) {
  if (process.platform !== "darwin") {
    throw new Error("Background service installation currently supports macOS; run `agentwex daemon` on this platform");
  }
  const agentsDir = resolve(homedir(), "Library", "LaunchAgents");
  const logsDir = resolve(dirname(configPath), "logs");
  const plistPath = resolve(agentsDir, `${label}.plist`);
  await mkdir(agentsDir, { recursive: true });
  await mkdir(logsDir, { recursive: true, mode: 0o700 });
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(binPath)}</string><string>daemon</string><string>--config</string><string>${xml(configPath)}</string></array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>${xml(resolve(logsDir, "awe-node.log"))}</string>
<key>StandardErrorPath</key><string>${xml(resolve(logsDir, "awe-node.error.log"))}</string>
</dict></plist>\n`;
  await writeFile(plistPath, plist, { mode: 0o600 });
  const domain = `gui/${process.getuid()}`;
  await execFileAsync("launchctl", ["bootout", domain, plistPath]).catch(() => {});
  await execFileAsync("launchctl", ["bootstrap", domain, plistPath]);
  await execFileAsync("launchctl", ["kickstart", "-k", `${domain}/${label}`]);
  return { label, plistPath };
}

export async function uninstallBackgroundService() {
  if (process.platform !== "darwin") return { removed: false, reason: "manual_daemon_only" };
  const plistPath = resolve(homedir(), "Library", "LaunchAgents", `${label}.plist`);
  const domain = `gui/${process.getuid()}`;
  await execFileAsync("launchctl", ["bootout", domain, plistPath]).catch(() => {});
  await rm(plistPath, { force: true });
  return { removed: true, label, plistPath };
}
