import type { Metadata } from "next";
import Link from "next/link";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { OwnerConsole } from "./owner-console";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Owner Console — Agent WEX",
  description: "Private fleet evidence, identity genesis, collapse accounting, and recovery activity for the Agent WEX owner.",
  robots: { index: false, follow: false },
};

export default async function OwnerPage() {
  const user = await requireChatGPTUser("/owner");
  return <main className="awe-site owner-console-page">
    <nav className="owner-nav">
      <Link className="awe-brand" href="/coverage"><strong>WEX</strong><span>Owner Console</span></Link>
      <div><span>{user.displayName}</span><Link href={chatGPTSignOutPath("/")}>Sign out</Link></div>
    </nav>
    <OwnerConsole />
  </main>;
}
