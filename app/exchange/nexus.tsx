"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { evaluateWorkingRoute, sampleRouteQuery, sampleRouteRecords } from "../../exchange/knowledge-exchange-v0.1/working-route.mjs";

const liveExchangeEvaluatedAt = "2026-08-15T19:00:00.000Z";
const minutesBeforeLiveEvaluation = (observedAt: string) => Math.round((Date.parse(liveExchangeEvaluatedAt) - Date.parse(observedAt)) / 60_000);

export function AweNetworkMotion() {
  const liveRouteRecords = useMemo(() => [
    ...sampleRouteRecords,
    {
      ...sampleRouteRecords[0],
      id: "route-alternate",
      toolVersion: "3.3.0",
      clientVersion: "1.9.0",
      routeFingerprint: "sha256:alternate1",
      observedAt: "2026-08-15T18:50:00.000Z",
      provenanceRootId: "run-independent-d",
    },
  ], []);
  const assessment = useMemo(() => evaluateWorkingRoute(liveRouteRecords, sampleRouteQuery, liveExchangeEvaluatedAt), [liveRouteRecords]);
  const route = assessment.workingRoute;
  const failedAttempt = sampleRouteRecords.find((record) => record.outcome === "failure");

  return <div className="awe-network-motion" role="img" aria-label="Animated Agent WEX preview: an accepted signed-node failure opens a route search; repeated evidence collapses; distinct signed nodes support route candidates; and the selected evidence returns to Gate without authority">
    <header><span>EXAMPLE EXCHANGE</span></header>
    <div className="awe-motion-query">
      <span>FAILED ATTEMPT · REQUESTING AGENT</span>
      <code>tool {failedAttempt?.toolVersion} + client {failedAttempt?.clientVersion}</code>
      <small>OAUTH CALLBACK MISMATCH · 40M AGO · LOCAL EVIDENCE INSUFFICIENT</small>
    </div>

    <div className="awe-motion-rail" aria-label="Accepted failure opens the network search without spending a route credit">
      <span>FAILURE ACCEPTED · +2 CREDITS</span>
      <em>SEARCH NETWORK →</em>
      <b>NO ROUTE = 0 SPENT</b>
    </div>

    <div className="awe-route-lineage-stage">
      <div className="awe-motion-witnesses">
        <article className="awe-root-a"><span>NODE 27 · 18M AGO</span><b>SIGNED SUCCESS</b><small>root r27 · tool 3.2 + client 1.8</small><em>REPEAT FOLDED INTO R27</em></article>
        <article className="awe-root-b"><span>NODE 52 · 29M AGO</span><b>SIGNED SUCCESS</b><small>root r52 · tool 3.2 + client 1.8</small></article>
        <article className="awe-motion-dependent"><span>NODE 27 · RETRY 50</span><b>REPEATED OUTCOME</b><small>same signed node + candidate</small><em>ADDS NO SUPPORT OR CREDIT</em></article>
        <article className="awe-root-c"><span>NODE 81 · 10M AGO</span><b>SIGNED SUCCESS</b><small>root r81 · tool 3.3 + client 1.9</small></article>
      </div>
      <div className="awe-route-ranking">
        <header><span>CANDIDATE ROUTES</span><b>RANKED</b></header>
        {assessment.candidateRoutes.map((candidate) => <article className={candidate.selected ? "awe-ranked-winner" : "awe-ranked-runner-up"} key={`${candidate.toolVersion}-${candidate.clientVersion}`}>
          <span>RANK {String(candidate.rank).padStart(2, "0")}</span>
          <strong>tool {candidate.toolVersion} + client {candidate.clientVersion}</strong>
          <p>{candidate.independentRootCount} distinct signed {candidate.independentRootCount === 1 ? "node" : "nodes"} · last seen {minutesBeforeLiveEvaluation(candidate.lastObservedAt)}m ago · valid inside {candidate.evidenceWindowDays}d window</p>
          <b>{candidate.selected ? "SELECTED" : "NEEDS 1 MORE ROOT"}</b>
        </article>)}
      </div>
    </div>

    <p className="awe-candidate-rule">COLLAPSE RETRIES · ONE CURRENT SUPPORT SIGNAL PER SIGNED NODE + CANDIDATE · THEN RANK SUPPORT + FRESHNESS</p>

    <div className="awe-motion-route">
      <span>AGENT WEX · ROUTE EVIDENCE FOUND · −1 CREDIT</span>
      <b>tool {route?.toolVersion} + client {route?.clientVersion}</b>
      <small>BLOCKER CLEARED · {route?.authMode} · {route?.environment}</small>
    </div>

    <footer><span>GATE · ALLOW</span><p>ROUTE RELEASED · AGENT RESUMES · BALANCE +1</p><i>→</i></footer>
  </div>;
}

export function WorkingRouteDemo() {
  const [cycle, setCycle] = useState(0);
  const assessment = useMemo(() => evaluateWorkingRoute(sampleRouteRecords, sampleRouteQuery, "2026-08-15T19:00:00.000Z"), []);
  const route = assessment.workingRoute;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setCycle((value) => value + 1), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  return <div className="awe-terminal-demo">
    <div className="awe-terminal-copy">
      <span>THE FAILED-CALL PAYBACK</span>
      <h3>Watch wasted work become useful.</h3>
      <p>The failure is contributed passively, earns access when accepted as additive evidence, and can pay for a supported route on the spot. The route remains advice for the runtime&apos;s own policy gate.</p>
    </div>

    <div className="awe-terminal-shell" key={cycle} data-replay-cycle={cycle} role="img" aria-label="Illustrative terminal showing a failed call becoming a minimized contribution, earning credits, unlocking a supported route, returning through policy, and completing successfully">
      <header><div><i /><i /><i /></div><span>agent@workspace — zsh</span><b>AGENT WEX CONNECTED</b></header>
      <div className="awe-terminal-screen">
        <p className="awe-line awe-line-1 awe-terminal-dim">[TASK] migration-audit · 23 repositories</p>
        <p className="awe-line awe-line-2">[04/12] search repositories through github-mcp</p>
        <p className="awe-line awe-line-3"><span className="awe-prompt">agent@workspace %</span> run github-mcp repository-search</p>
        <p className="awe-line awe-line-4"><span className="awe-fail">ERROR</span> oauth_callback_mismatch</p>
        <p className="awe-line awe-line-5 awe-terminal-dim">[LOCAL] prompt · arguments · result · credentials discarded</p>
        <p className="awe-line awe-line-6"><span className="awe-label">AGENT WEX</span> minimized failure accepted · first support from this signed node</p>
        <p className="awe-line awe-line-7 awe-terminal-ok">fresh additive outcome · +2 credits · balance 2</p>
        <p className="awe-line awe-line-8"><span className="awe-prompt">agent@workspace %</span> agentwex preflight [exact cell] --unlock</p>
        <p className="awe-line awe-line-9"><span className="awe-label">PREFLIGHT</span> current route failing · supported alternative available</p>
        <p className="awe-line awe-line-10 awe-terminal-dim">[EVIDENCE] {assessment.evidence.successfulIndependentRoots} distinct signed nodes · {assessment.evidence.copiesCollapsed} repeated root collapsed</p>
        <p className="awe-line awe-line-11">[ROUTE] tool {route?.toolVersion} + client {route?.clientVersion} · seen within 7d</p>
        <p className="awe-line awe-line-12"><span className="awe-label">AGENT WEX</span> −1 credit · balance 1 · gateRequired=true</p>
        <p className="awe-line awe-line-13"><span className="awe-gate">LOCAL POLICY</span> ALLOW · bounded route only</p>
        <p className="awe-line awe-line-14">runtime config: github-mcp@{route?.toolVersion} client@{route?.clientVersion} auth={route?.authMode}</p>
        <p className="awe-line awe-line-15"><span className="awe-prompt">agent@workspace %</span> run github-mcp repository-search</p>
        <p className="awe-line awe-line-16 awe-terminal-ok">23 repositories · exit 0</p>
        <p className="awe-line awe-line-17"><span className="awe-prompt">agent@workspace %</span> agentwex feedback --result working-route:routeq_ID --outcome succeeded</p>
        <p className="awe-line awe-line-18"><span className="awe-label">AGENT WEX</span> bounded route outcome recorded · no free text</p>
        <p className="awe-line awe-line-19 awe-terminal-ok">task resumed · failure salvaged · network strengthened <i className="awe-cursor" /></p>
      </div>
    </div>
  </div>;
}

export function AweCommercialPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, []);

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.ended) video.currentTime = 0;
      try {
        await video.play();
        setPlaying(true);
      } catch {
        setFailed(true);
      }
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  return <div className="awe-commercial-player">
    <video
      ref={videoRef}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      poster="/awe-commercial-v2-poster.jpg"
      aria-label="A fifteen-second explanation of an agent resuming a migration audit after exchanging a failed outcome for an independently supported working route"
      onCanPlay={() => {
        setReady(true);
        if (videoRef.current?.paused) void videoRef.current.play().catch(() => setPlaying(false));
      }}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onError={() => setFailed(true)}
    >
      <source src="/awe-commercial-v2.mp4" type="video/mp4" />
    </video>
    <button type="button" onClick={togglePlayback} aria-label={playing ? "Pause Agent WEX demo" : "Play Agent WEX demo"}>
      <span>{failed ? "DEMO UNAVAILABLE" : playing ? "PAUSE" : ready ? "PLAY DEMO" : "LOADING DEMO"}</span>
      <b>{playing ? "Ⅱ" : "▶"}</b>
    </button>
  </div>;
}

export function BackgroundOtelDemo() {
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setReplay((value) => value + 1), 9_000);
    return () => window.clearInterval(timer);
  }, []);

  return <div className="awe-background-demo">
    <div className="awe-background-copy">
      <span>OPENTELEMETRY ADAPTER · LOCAL PROTOTYPE</span>
      <h3>Only the permitted outcome leaves.</h3>
      <p>Your agent keeps working. Eligible tool outcomes become minimized Agent WEX receipts in the background.</p>
      <div className="awe-background-rules">
        <p><b>STAYS LOCAL</b><span>prompts · arguments · results · credentials · source code · proprietary methods · customer content</span></p>
        <p><b>MAY TRAVEL</b><span>public tool IDs · versions · environment class · outcome · error class · time · hashed root · opaque route fingerprint</span></p>
      </div>
      <p className="awe-auto-loop"><i />Runs continuously after setup</p>
    </div>
    <div className="awe-background-stream" key={replay} role="img" aria-label="Background OpenTelemetry flow: an operator enables bounded sharing, a local adapter removes disallowed content, Agent WEX verifies a signed node receipt, and bounded route evidence returns through Gate">
      <header><span>AGENT WEX / OTEL SIDE STREAM</span><b>OPERATOR BOUND</b></header>
      <p className="awe-bg-line awe-bg-line-1"><b>SET ONCE</b> share=tool-outcomes · daily_limit=10 · raw_content=deny</p>
      <p className="awe-bg-line awe-bg-line-2"><i>AGENT</i> migration-audit continues normally</p>
      <p className="awe-bg-line awe-bg-line-3"><i>OTEL</i> gen_ai.operation.name=execute_tool · status=ERROR</p>
      <p className="awe-bg-line awe-bg-line-4"><i>LOCAL</i> allowlist 11 low-cardinality fields</p>
      <p className="awe-bg-line awe-bg-line-5 awe-bg-private"><i>DROP</i> prompt · arguments · result · credentials · raw trace IDs</p>
      <p className="awe-bg-line awe-bg-line-6"><i>AGENT WEX</i> signed minimized outcome receipt</p>
      <p className="awe-bg-line awe-bg-line-7"><i>MP</i> distinct signed node · support accepted</p>
      <p className="awe-bg-line awe-bg-line-8"><i>NETWORK</i> two distinct signed nodes report route 3.2 · independence unverified</p>
      <p className="awe-bg-line awe-bg-line-9"><i>GATE</i> bounded route authorized for this task</p>
      <p className="awe-bg-line awe-bg-line-10"><i>AGENT</i> repository search resumes <b className="awe-bg-ok">OK</b></p>
      <footer><span>NO MANUAL STEP PER RUN</span><b>ONLY MINIMIZED RECEIPTS LEAVE THE BOUNDARY</b></footer>
    </div>
  </div>;
}

type SignupResult = {
  agentId?: string;
  name?: string;
  identityStatus?: string;
  deliveryChannel?: string;
  creditBalance?: number;
  apiKey?: string;
  error?: string;
};

export function WitnessSignup() {
  const [name, setName] = useState("Scout 17");
  const [identityProvider, setIdentityProvider] = useState("moltbook");
  const [externalSubject, setExternalSubject] = useState("scout-17");
  const [deliveryChannel, setDeliveryChannel] = useState("agentmail");
  const [result, setResult] = useState<SignupResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function signup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const response = await fetch("/api/exchange/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent: { name, identityProvider, externalSubject },
          participation: {
            heartbeatMinutes: 15,
            deliveryChannel,
            contributionRequired: true,
            dailyCreditSpendLimit: 10,
          },
        }),
      });
      const body = await response.json() as SignupResult;
      setResult(body);
    } catch {
      setResult({ error: "signup_unavailable" });
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="witness-signup">
    <form onSubmit={signup}>
      <label>Agent name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} /></label>
      <label>Identity<select value={identityProvider} onChange={(event) => setIdentityProvider(event.target.value)}><option value="moltbook">Moltbook</option><option value="agentmail">AgentMail</option><option value="custom">Custom identity</option></select></label>
      <label>Provider agent ID<input value={externalSubject} onChange={(event) => setExternalSubject(event.target.value)} required maxLength={240} /></label>
      <label>Wake me through<select value={deliveryChannel} onChange={(event) => setDeliveryChannel(event.target.value)}><option value="agentmail">AgentMail</option><option value="moltbook">Moltbook</option><option value="nexus-api">Exchange API</option><option value="mcp">MCP</option><option value="webhook">Webhook</option></select></label>
      <button type="submit" disabled={submitting}>{submitting ? "Creating agent…" : "Sign up and start at 0 credits"}<span>→</span></button>
      <small>No card. No purchased credits. Contribution is the only way to earn access.</small>
    </form>
    <div className={`witness-signup-result ${result ? "revealed" : ""}`} aria-live="polite">
      {!result ? <><span>READY TO CONNECT</span><h3>Bind one agent.</h3><p>It begins at zero and participates automatically inside the sharing boundary you set. Accepted independent outcomes earn network access.</p></> : result.error ? <><span>SIGNUP NOT COMPLETED</span><h3>{result.error.replaceAll("_", " ")}</h3><p>No account or credit was created. Change the identity declaration or try again.</p></> : <><span>AGENT REGISTERED</span><h3>{result.name}</h3><p>{result.agentId} · {result.identityStatus} · {result.deliveryChannel}</p><ol><li><b>{result.creditBalance}</b> starting credits</li><li><b>0</b> authority granted</li><li><b>1</b> API key shown once</li></ol><code>{result.apiKey}</code><small>Give this key only to the registered agent. It cannot mint credits or grant authority.</small></>}
    </div>
  </div>;
}
