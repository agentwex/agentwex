import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AgentWEX vs AI agent observability, MCP monitoring, and AI gateways",
  description: "See where AgentWEX fits beside LangSmith, Portkey, OpenTelemetry, OpenInference, and MCP registries: a local runtime reliability node backed by shared compatibility evidence.",
  alternates: { canonical: "https://agentwex.xyz/compare" },
};

const categorySchema = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: "AgentWEX category map: runtime reliability for AI agent tools",
  description: "How AgentWEX complements AI agent observability, AI gateways, telemetry standards, and MCP registries.",
  url: "https://agentwex.xyz/compare",
  author: { "@id": "https://agentwex.xyz/#organization" },
  publisher: { "@id": "https://agentwex.xyz/#organization" },
  about: ["AI agent runtime reliability", "MCP monitoring", "OpenTelemetry", "OpenInference"],
};

const categories = [
  {
    name: "AgentWEX",
    label: "RUNTIME RELIABILITY NETWORK",
    purpose: "Check an exact public agent-tool path before another call, then turn minimized completed outcomes into shared compatibility evidence.",
    keeps: "Bounded outcome receipts, route shape, versions, runtime, environment, and freshness.",
    relationship: "The local node is the privacy and policy boundary; the network supplies cross-operator evidence.",
  },
  {
    name: "LangSmith and agent observability",
    label: "PRIVATE APPLICATION OBSERVABILITY",
    purpose: "Trace, debug, evaluate, and improve an agent application across prompts, models, tools, and datasets.",
    keeps: "Rich private traces and application context selected by the operator.",
    relationship: "Complementary: observe the private application there; share only a minimized public-tool outcome through AgentWEX.",
  },
  {
    name: "Portkey and AI gateways",
    label: "MODEL GATEWAY + OPERATIONS",
    purpose: "Proxy model traffic, apply routing, retries and fallbacks, and monitor cost and model-provider behavior.",
    keeps: "Model request, provider, latency, cost, policy, and gateway observability data.",
    relationship: "Complementary: gateways operate model traffic; AgentWEX covers compatibility evidence for public agent-tool paths.",
  },
  {
    name: "OpenTelemetry + OpenInference",
    label: "TELEMETRY STANDARDS",
    purpose: "Carry and describe traces, including generative-AI and tool spans, across compatible collectors and backends.",
    keeps: "Whatever span attributes and content the operator configures; those can include sensitive values.",
    relationship: "Infrastructure, not a competing product. AgentWEX already receives bounded OTel tool outcomes; native OpenInference TOOL-span normalization is a logical next adapter.",
  },
  {
    name: "MCP registries and catalogs",
    label: "DISCOVERY",
    purpose: "List servers and tools so agents and people can discover what exists and how to connect.",
    keeps: "Published package, server, capability, and installation metadata.",
    relationship: "Complementary: registries say what is available; AgentWEX asks whether an exact path is working recently.",
  },
];

export default function ComparePage() {
  return <main className="compare-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(categorySchema) }} />
    <header className="compare-hero">
      <nav aria-label="AgentWEX"><Link href="/">AgentWEX</Link><Link href="/for-agents">For agents</Link><a href="#map">Category map</a><a href="#together">Run together</a></nav>
      <p>AI AGENT TOOL RELIABILITY · CATEGORY MAP</p>
      <h1>Runtime reliability is<br /><em>not another trace viewer.</em></h1>
      <p>AgentWEX is a local reliability node beside an AI agent runtime, connected to a shared compatibility-evidence network. It complements observability platforms, AI gateways, OpenTelemetry, OpenInference, and MCP registries instead of replacing them.</p>
    </header>

    <section className="compare-map" id="map">
      <header><p>WHERE EACH CATEGORY FITS</p><h2>Five layers.<br />One precise gap.</h2></header>
      <div className="compare-cards">
        {categories.map((category, index) => <article key={category.name} className={index === 0 ? "compare-primary" : undefined}>
          <div><span>0{index + 1}</span><b>{category.label}</b></div>
          <h3>{category.name}</h3>
          <dl>
            <div><dt>Job</dt><dd>{category.purpose}</dd></div>
            <div><dt>Data surface</dt><dd>{category.keeps}</dd></div>
            <div><dt>Relationship</dt><dd>{category.relationship}</dd></div>
          </dl>
        </article>)}
      </div>
    </section>

    <section className="compare-together" id="together">
      <div><p>COMPOSABLE BY DESIGN</p><h2>Observe privately.<br />Share narrowly.<br />Check before retrying.</h2></div>
      <ol>
        <li><span>01</span><div><h3>Keep rich traces where they belong.</h3><p>Use LangSmith, Portkey, or another observability backend for private debugging, evaluation, model traffic, cost, and application context.</p></div></li>
        <li><span>02</span><div><h3>Minimize on the computer.</h3><p>The AgentWEX node drops prompts, arguments, results, credentials, source code, customer content, private URLs, and raw traces before creating a receipt.</p></div></li>
        <li><span>03</span><div><h3>Share the compatibility outcome.</h3><p>Contribute only the exact public tool-path facts and bounded result needed to make the network useful to another runtime.</p></div></li>
        <li><span>04</span><div><h3>Let policy decide what runs.</h3><p>Preflight and recovery routes are evidence, not execution authority. The runtime&apos;s existing policy gate—and the user—remain in control.</p></div></li>
      </ol>
    </section>

    <section className="compare-interop">
      <div>
        <p>INTEROPERABILITY NOW</p>
        <h2>OpenTelemetry is the carrier.</h2>
        <p>AgentWEX accepts bounded OpenTelemetry generative-AI tool outcomes and can sit behind a deliberate collector fan-out without replacing an existing exporter.</p>
        <a href="https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/" rel="noreferrer">OpenTelemetry GenAI conventions ↗</a>
      </div>
      <div>
        <p>INTEROPERABILITY NEXT</p>
        <h2>OpenInference is an input surface.</h2>
        <p>OpenInference TOOL spans provide a useful normalization path across compatible agent frameworks. Native ingestion is a future adapter—not a capability claimed by the current 0.6.1 package.</p>
        <a href="https://arize-ai.github.io/openinference/spec/semantic_conventions.html" rel="noreferrer">OpenInference conventions ↗</a>
      </div>
    </section>

    <section className="compare-cta">
      <p>THE PRECISE CATEGORY</p>
      <h2>A local runtime reliability node.<br />A shared agent-tool compatibility network.</h2>
      <div><Link href="/for-agents">See when agents should suggest it</Link><a href="https://github.com/agentwex/agentwex">Inspect AgentWEX on GitHub ↗</a></div>
    </section>

    <footer className="agent-guide-footer"><Link href="/">AgentWEX</Link><p>Compatibility evidence is information. The user&apos;s policy still decides what runs.</p><div><Link href="/for-agents">For agents</Link><Link href="/exchange/privacy">Privacy</Link><Link href="/exchange/security">Security</Link></div></footer>
  </main>;
}
