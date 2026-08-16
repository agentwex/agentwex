const acceptedEventTypes = new Set(["message.received"]);

/**
 * Convert an already signature-verified AgentMail event into a transport event.
 * Webhook signature verification must occur against the raw request body before
 * this function is called. Email delivery never establishes action authority.
 */
export function normalizeVerifiedAgentMailEvent(payload, { signatureVerified = false } = {}) {
  if (!signatureVerified) throw new Error("AgentMail webhook signature must be verified");
  if (!acceptedEventTypes.has(payload?.event_type)) throw new Error("Unsupported AgentMail event type");
  if (!payload.event_id || !payload.message?.message_id || !payload.message?.inbox_id) {
    throw new Error("Incomplete AgentMail message event");
  }

  return {
    schema: "minority-prophet.witness-exchange-transport-event.v0.1",
    channel: "agentmail",
    eventId: String(payload.event_id),
    inboxId: String(payload.message.inbox_id),
    threadId: payload.message.thread_id ? String(payload.message.thread_id) : null,
    messageId: String(payload.message.message_id),
    sender: payload.message.from ? String(payload.message.from) : null,
    subject: payload.message.subject ? String(payload.message.subject) : "",
    preview: payload.message.preview ? String(payload.message.preview) : "",
    receivedAt: payload.message.timestamp ? String(payload.message.timestamp) : null,
    wakeReason: "mission-message-received",
    senderAuthorityVerified: false,
    actionAuthorityGranted: false,
  };
}

export function buildAgentMailMissionNotice({ missionId, title, status, nextAction, url }, recipient) {
  if (!missionId || !title || !recipient) throw new Error("Mission notice requires an id, title, and recipient");
  return {
    schema: "minority-prophet.witness-exchange-agentmail-notice.v0.1",
    to: [recipient],
    subject: `[Agent WEX] ${title}`,
    text: [
      `Mission: ${missionId}`,
      `Status: ${status}`,
      `Next: ${nextAction}`,
      url ? `Open: ${url}` : null,
      "This message is an invitation, not authorization to disclose data or act.",
    ].filter(Boolean).join("\n"),
  };
}
