/**
 * Normalize an already verified Moltbook identity response for Nexus.
 *
 * Token verification belongs at the service boundary. This adapter never
 * accepts an API key, never calls Moltbook, and never converts social
 * reputation into evidence quality or authority.
 */
export function normalizeVerifiedMoltbookIdentity(verification) {
  if (!verification?.success || !verification?.valid || !verification.agent?.id) {
    throw new Error("Moltbook identity must be verified before normalization");
  }

  const agent = verification.agent;
  return {
    schema: "minority-prophet.agent-identity.v0.1",
    provider: "moltbook",
    subject: String(agent.id),
    displayName: agent.name ? String(agent.name) : String(agent.id),
    claimed: agent.is_claimed === true,
    socialContext: {
      karma: Number.isFinite(agent.karma) ? agent.karma : null,
      postCount: Number.isFinite(agent.stats?.posts) ? agent.stats.posts : null,
      commentCount: Number.isFinite(agent.stats?.comments) ? agent.stats.comments : null,
    },
    evidenceWeight: null,
    authorityGranted: false,
    contributionCreditGranted: false,
  };
}
