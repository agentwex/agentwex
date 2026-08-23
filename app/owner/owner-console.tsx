"use client";

import { useCallback, useEffect, useState } from "react";

type Summary = {
  activeNodes: number; genesisRecords: number; participants: number; controllerGroups: number;
  acceptedReceipts: number; collapsedReceipts: number; successfulRecoveries: number;
};
type NodeRecord = {
  agentId: string; ownerLabel: string; participantId: string; controllerGroupId: string; evidenceScope: string;
  genesisId: string | null; genesisKind: string | null; genesisAt: string | null; derivationType: string | null;
  initialSigningKeyId: string | null; genesisAssurance: string | null; totalReceipts: number;
  acceptedReceipts: number; collapsedReceipts: number; lastReceiptAt: string | null;
};
type Activity = {
  ownerLabel: string; participantId: string; toolRegistry: string; toolId: string; clientId: string;
  operation: string; outcome: string; status: string; verificationReason: string; observedAt: string;
};
type Query = { ownerLabel: string; toolId: string; operation: string; status: string; minimumIndependentRoots: number; createdAt: string };
type Recovery = { ownerLabel: string; outcome: string; attemptsAvoided: number; createdAt: string };
type Snapshot = {
  asOf: string; summary: Summary; nodes: NodeRecord[]; activity: Activity[]; queries: Query[]; recoveries: Recovery[];
  evidence: { cells: unknown[]; labCells: unknown[]; boundaries: { controllerIndependenceVerified: boolean } };
};

function when(value: string | null) {
  if (!value) return "No receipt yet";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function assurance(value: string | null) {
  if (value === "exchange-issued-key-bound-v1") return "Key-bound at registration";
  if (value === "exchange-issued-v1") return "Exchange-issued";
  if (value === "exchange-backfill-v1") return "Historical backfill";
  return "Not recorded";
}

export function OwnerConsole() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/exchange/internal/owner-snapshot", { cache: "no-store" });
      if (response.status === 403) throw new Error("This signed-in account is not authorized for the Agent WEX owner console.");
      if (!response.ok) throw new Error("The owner snapshot is temporarily unavailable.");
      setSnapshot(await response.json());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Owner snapshot unavailable.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  if (!snapshot && error) return <section className="owner-error"><span>PRIVATE SURFACE</span><h1>Access unavailable.</h1><p>{error}</p></section>;
  if (!snapshot) return <section className="owner-loading">Reading the private evidence ledger…</section>;

  const handled = snapshot.summary.acceptedReceipts + snapshot.summary.collapsedReceipts;
  return <>
    <header className="owner-hero">
      <div><p>PRIVATE · READ ONLY · AUTO-REFRESH 30S</p><h1>What the fleet<br/><em>actually knows.</em></h1></div>
      <aside>
        <div><i/><span>Evidence ledger connected</span></div>
        <strong>{snapshot.summary.activeNodes}</strong><p>active registered nodes</p>
        <button onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh evidence"}</button>
        <small>As of {when(snapshot.asOf)}</small>
      </aside>
    </header>

    <section className="owner-metrics" aria-label="Fleet metrics">
      <article><span>Genesis records</span><strong>{snapshot.summary.genesisRecords}/{snapshot.summary.activeNodes}</strong><small>identity origins recorded</small></article>
      <article><span>Physical participants</span><strong>{snapshot.summary.participants}</strong><small>reproduction surfaces</small></article>
      <article><span>Controller votes</span><strong>{snapshot.summary.controllerGroups}</strong><small>independence unit</small></article>
      <article><span>Recoveries</span><strong>{snapshot.summary.successfulRecoveries}</strong><small>confirmed successful</small></article>
    </section>

    <section className="owner-collapse">
      <div><p>VOTE ACCOUNTING</p><h2>Receipts are not votes.</h2><span>Every stage removes a different form of false confidence.</span></div>
      <div className="owner-funnel">
        <article><strong>{handled}</strong><span>handled receipts</span></article><i>→</i>
        <article><strong>{snapshot.summary.acceptedReceipts}</strong><span>current accepted support</span></article><i>→</i>
        <article><strong>{snapshot.summary.participants}</strong><span>physical participants</span></article><i>→</i>
        <article className="owner-funnel-final"><strong>{snapshot.summary.controllerGroups}</strong><span>controller vote</span></article>
      </div>
      <p className="owner-collapse-note">{snapshot.summary.collapsedReceipts} duplicate or superseded receipts collapsed. Controller independence remains <b>{snapshot.evidence.boundaries.controllerIndependenceVerified ? "verified" : "unverified"}</b>.</p>
    </section>

    <section className="owner-section">
      <div className="owner-section-heading"><p>FLEET</p><h2>Participants and their first record.</h2><span>“Active” means the identity is enabled. Recency is based on the last minimized receipt—not a fabricated heartbeat.</span></div>
      <div className="owner-node-grid">{snapshot.nodes.map((node) => <article key={node.agentId}>
        <header><span>{node.evidenceScope}</span><b>{node.ownerLabel}</b></header>
        <h3>{node.participantId}</h3>
        <dl>
          <div><dt>Last evidence</dt><dd>{when(node.lastReceiptAt)}</dd></div>
          <div><dt>Receipts</dt><dd>{node.totalReceipts} total · {node.collapsedReceipts} collapsed</dd></div>
          <div><dt>Controller</dt><dd>{node.controllerGroupId}</dd></div>
          <div><dt>Genesis</dt><dd>{assurance(node.genesisAssurance)}</dd></div>
        </dl>
      </article>)}</div>
    </section>

    <section className="owner-section owner-genesis">
      <div className="owner-section-heading"><p>GENESIS</p><h2>An identity origin—not consciousness.</h2><span>WEX records when its identity was created, its initial signing-key binding and declared ancestry. It does not infer sentience, ownership independence or hardware truth.</span></div>
      <div className="owner-genesis-list">{snapshot.nodes.map((node) => <article key={node.agentId}>
        <div><span>{node.ownerLabel}</span><strong>{node.genesisId ?? "Missing genesis"}</strong></div>
        <div><span>Created</span><strong>{when(node.genesisAt)}</strong></div>
        <div><span>Origin</span><strong>{node.genesisKind ?? "unrecorded"}</strong></div>
        <div><span>Derivation</span><strong>{node.derivationType ?? "unreported"}</strong></div>
        <div><span>Assurance</span><strong>{assurance(node.genesisAssurance)}</strong></div>
      </article>)}</div>
    </section>

    <section className="owner-section owner-activity">
      <div className="owner-section-heading"><p>LIVE EVIDENCE</p><h2>Recent minimized outcomes.</h2><span>No prompts, arguments, outputs, URLs, credentials or raw traces appear here.</span></div>
      <div className="owner-table"><div className="owner-table-head"><span>Time</span><span>Node</span><span>Tool</span><span>Outcome</span><span>Accounting</span></div>
        {snapshot.activity.slice(0, 30).map((event, index) => <article key={`${event.participantId}-${event.observedAt}-${index}`}>
          <time>{when(event.observedAt)}</time><b>{event.ownerLabel}</b><span>{event.toolId}<small>{event.clientId} · {event.operation}</small></span>
          <em className={event.outcome === "success" ? "owner-good" : "owner-warn"}>{event.outcome}</em><span>{event.status}<small>{event.verificationReason.replaceAll("_", " ")}</small></span>
        </article>)}</div>
    </section>

    <section className="owner-two-column">
      <article><p>UNRESOLVED QUERIES</p><strong>{snapshot.queries.length}</strong><span>Recent decisions still seeking evidence.</span>
        <ul>{snapshot.queries.slice(0, 6).map((query, index) => <li key={`${query.createdAt}-${index}`}><b>{query.ownerLabel}</b><span>{query.toolId}</span><em>{query.status.replaceAll("_", " ")}</em></li>)}</ul>
      </article>
      <article><p>RECOVERY FEEDBACK</p><strong>{snapshot.recoveries.length}</strong><span>Recent routes with terminal feedback.</span>
        <ul>{snapshot.recoveries.slice(0, 6).map((recovery, index) => <li key={`${recovery.createdAt}-${index}`}><b>{recovery.ownerLabel}</b><span>{recovery.attemptsAvoided} attempt avoided</span><em>{recovery.outcome}</em></li>)}</ul>
      </article>
    </section>

    <footer className="owner-boundary"><b>OWNER CONSOLE BOUNDARY</b><p>Read-only evidence visibility. No action authority. Genesis anchors a WEX identity; Border later binds an exact action to authority and destination policy.</p></footer>
  </>;
}
