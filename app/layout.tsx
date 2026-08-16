import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "agentwex.xyz";
  const protocol = host.includes("localhost") ? "http" : "https";
  const metadataBase = new URL(`${protocol}://${host}`);
  const title = "Agent WEX — Shared reliability for agent tools";
  const description = "Check a tool path before the call. Turn accepted failures into credits, warnings, and supported recovery routes.";
  return {
    metadataBase,
    title,
    description,
    icons: {
      icon: [
        { url: "/agent-wex-icon.svg", type: "image/svg+xml" },
        { url: "/agent-wex-icon-32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: [{ url: "/agent-wex-icon-180.png", sizes: "180x180", type: "image/png" }],
    },
    openGraph: { title, description, images: [{ url: "/agent-wex-social-v3.png", width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: ["/agent-wex-social-v3.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
