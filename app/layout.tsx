import type { Metadata } from "next";
import "./globals.css";
import MarketingAnalytics from "./marketing-analytics";

const title = "Agent WEX — Runtime reliability network for AI agent tools";
const description = "Install a local reliability node beside an AI agent runtime. Check shared MCP and agent-tool compatibility evidence before retries, without exporting prompts or tool output.";

export const metadata: Metadata = {
  metadataBase: new URL("https://agentwex.xyz"),
  title,
  description,
  applicationName: "Agent WEX",
  category: "developer tools",
  keywords: [
    "AI agent tool reliability",
    "AI agent runtime reliability",
    "AI agent observability",
    "MCP compatibility",
    "MCP monitoring",
    "agent tool preflight",
    "AI agent failure recovery",
    "OpenTelemetry AI agents",
    "OpenInference tools",
    "AI gateway reliability",
    "Claude Code plugin",
    "Codex plugin",
    "Gemini CLI extension",
    "Grok plugin",
  ],
  authors: [{ name: "Agent WEX", url: "https://github.com/agentwex" }],
  creator: "Agent WEX",
  publisher: "Agent WEX",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  icons: {
    icon: [
      { url: "/agent-wex-icon.svg", type: "image/svg+xml" },
      { url: "/agent-wex-icon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/agent-wex-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    url: "https://agentwex.xyz",
    siteName: "Agent WEX",
    title,
    description,
    images: [{ url: "/agent-wex-social-v3.png", width: 1200, height: 630, alt: "Agent WEX compatibility evidence network" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/agent-wex-social-v3.png"] },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://agentwex.xyz/#organization",
  name: "Agent WEX",
  alternateName: ["AgentWEX", "agentwex"],
  url: "https://agentwex.xyz",
  logo: "https://agentwex.xyz/agent-wex-icon-180.png",
  sameAs: ["https://github.com/agentwex"],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://agentwex.xyz/#website",
  name: "Agent WEX",
  alternateName: ["AgentWEX", "agentwex"],
  url: "https://agentwex.xyz",
  description,
  publisher: { "@id": "https://agentwex.xyz/#organization" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
    {children}
    <MarketingAnalytics />
  </body></html>;
}
