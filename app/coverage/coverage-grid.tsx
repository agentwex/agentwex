"use client";

import { useEffect, useState } from "react";

type CoverageCell = {
  toolRegistry: string;
  toolId: string;
  toolVersion: string;
  clientId: string;
  clientVersion: string;
  environment: string;
  authMode: string;
  operation: string;
  outcome: string;
  resolutionKind: string;
  acceptedReceipts: number;
  distinctSignedNodes: number;
  distinctControllerGroups: number;
  distinctParticipants: number;
  distinctRouteVariants: number;
  lastObservedDate: string | null;
  freshnessDays: number | null;
  freshness: string;
  evidenceStatus: string;
};

type CoveragePayload = {
  asOf: string;
  minimumDistinctSignedNodes: number;
  minimumDistinctControllerGroups: number;
  minimumLabParticipants: number;
  cells: CoverageCell[];
  labCells: CoverageCell[];
};

function Cells({ cells, label }: { cells: CoverageCell[]; label: string }) {
  return <div className="awe-coverage-grid-group"><p className="awe-coverage-grid-label">{label}</p><div className="awe-coverage-grid">
    {cells.map((cell) => <article key={[cell.evidenceStatus, cell.toolRegistry, cell.toolId, cell.toolVersion, cell.clientId, cell.clientVersion, cell.environment, cell.authMode, cell.operation, cell.outcome, cell.resolutionKind].join("|")}>
      <header><span className={`awe-freshness awe-freshness-${cell.freshness}`}>{cell.freshness}</span><b>{cell.outcome}</b></header>
      <h2>{cell.toolId}</h2>
      <p>{cell.operation} · {cell.environment}</p>
      <dl>
        <div><dt>Tool</dt><dd>{cell.toolRegistry} · {cell.toolVersion}</dd></div>
        <div><dt>Client</dt><dd>{cell.clientId} · {cell.clientVersion}</dd></div>
        <div><dt>Auth</dt><dd>{cell.authMode}</dd></div>
        <div><dt>Support</dt><dd>{cell.evidenceStatus === "first-party-lab-replicated" ? `${cell.distinctParticipants} lab participants · 1 controller` : `${cell.distinctControllerGroups} controller groups`}</dd></div>
        <div><dt>Last seen</dt><dd>{cell.lastObservedDate ?? "unknown"}</dd></div>
      </dl>
    </article>)}
  </div></div>;
}

export function CoverageGrid() {
  const [payload, setPayload] = useState<CoveragePayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/exchange/coverage")
      .then((response) => {
        if (!response.ok) throw new Error("coverage unavailable");
        return response.json();
      })
      .then(setPayload)
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <div className="awe-coverage-empty"><b>Coverage is temporarily unavailable.</b><span>The exchange itself remains separate from this public index.</span></div>;
  if (!payload) return <div className="awe-coverage-loading" aria-live="polite">Reading current coverage…</div>;
  if (payload.cells.length === 0 && payload.labCells.length === 0) return <div className="awe-coverage-empty"><b>The public network is early.</b><span>No compatibility cell has reached either the lab-reproduction or network-support threshold yet. Sparse evidence stays private.</span></div>;

  return <div className="awe-coverage-groups">
    {payload.cells.length > 0 && <Cells cells={payload.cells} label="NETWORK SUPPORTED" />}
    {payload.labCells.length > 0 && <Cells cells={payload.labCells} label="FIRST-PARTY LAB REPRODUCED" />}
  </div>;
}
