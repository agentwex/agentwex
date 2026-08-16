"use client";

import { useEffect, useRef, useState } from "react";

export function AweCommand({ step, label, command }: { step: string; label: string; command: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return <div className="awe-one-command">
    <header>
      <span>{step}</span>
      <b>{label}</b>
      <button className="awe-command-copy" type="button" onClick={copyCommand} aria-label={`Copy ${label.toLowerCase()} command`}>
        <i aria-hidden="true">{copied ? "✓" : "⧉"}</i>{copied ? "COPIED" : "COPY"}
      </button>
    </header>
    <code><i>$</i>{command}</code>
  </div>;
}
