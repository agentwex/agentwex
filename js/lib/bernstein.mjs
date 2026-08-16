function explicitEventOutcome(name) {
  if (name === "task_completed") return "OK";
  if (name === "task_failed") return "ERROR";
  return null;
}

/**
 * Translate the deliberately tiny Bernstein plugin contract into Agent WEX's
 * canonical completed-route shape. The adapter never reads task titles,
 * prompts, result summaries, errors, diffs, source, or model output.
 */
export function spansFromBernsteinEvents(payload, adapter = {}) {
  const events = payload?.schema === "agentwex.bernstein-hook.v0.1" && Array.isArray(payload.events)
    ? payload.events
    : [];
  const spans = [];
  let ignored = 0;
  for (const event of events) {
    const status = explicitEventOutcome(event?.event);
    const toolName = event?.toolName;
    const mapping = adapter.tools?.[toolName];
    if (
      adapter.enabled !== true
      || !status
      || !mapping
      || typeof event.taskId !== "string"
      || event.taskId.length === 0
      || typeof event.observedAt !== "string"
      || Number.isNaN(Date.parse(event.observedAt))
    ) {
      ignored += 1;
      continue;
    }
    spans.push({
      traceId: `bernstein:${event.taskId}`,
      spanId: "bernstein-task-outcome",
      endTime: event.observedAt,
      status: { code: status },
      resource: { attributes: {} },
      attributes: {
        "gen_ai.operation.name": "execute_tool",
        "gen_ai.tool.name": mapping.toolId ?? toolName,
        "awe.tool.registry": mapping.toolRegistry,
        "awe.tool.version": mapping.toolVersion,
        "awe.client.id": "bernstein",
        "awe.client.version": adapter.clientVersion,
        "awe.environment": adapter.environment,
        "awe.auth.mode": mapping.authMode,
        "awe.operation": mapping.operation ?? toolName,
        "awe.capability.id": mapping.capabilityId,
        "awe.effect.class": mapping.effectClass,
        "awe.resolution.kind": mapping.resolutionKind ?? "none",
        "error.type": status === "ERROR" ? "other" : undefined,
      },
    });
  }
  return { received: events.length, ignored, spans };
}

export function bernsteinPluginSource() {
  return `"""Agent WEX Bernstein lifecycle adapter.

Generated locally by Agent WEX. This plugin deliberately ignores task titles,
result summaries, error text, prompts, outputs, diffs, and source code.
"""
from __future__ import annotations

import json
import os
import threading
import time
import urllib.request

from bernstein.plugins import hookimpl


def _post(event: str, task_id: str, role: str) -> None:
    endpoint = os.environ.get("AGENT_WEX_BERNSTEIN_ENDPOINT", "")
    token = os.environ.get("AGENT_WEX_BERNSTEIN_TOKEN", "")
    tool_name = os.environ.get("AGENT_WEX_BERNSTEIN_TOOL", "")
    expected_role = os.environ.get("AGENT_WEX_BERNSTEIN_ROLE", "")
    if not endpoint or not token or not tool_name or not task_id or not expected_role or role != expected_role:
        return
    body = json.dumps({
        "schema": "agentwex.bernstein-hook.v0.1",
        "events": [{
            "event": event,
            "taskId": task_id,
            "toolName": tool_name,
            "observedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }],
    }).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=body,
        method="POST",
        headers={
            "authorization": f"Bearer {token}",
            "content-type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=2):
            pass
    except Exception:
        # Bernstein isolates plugin failures; Agent WEX must never stop a run.
        return


def _background(event: str, task_id: str, role: str) -> None:
    threading.Thread(target=_post, args=(event, task_id, role), daemon=True).start()


class AgentWexPlugin:
    @hookimpl
    def on_task_completed(self, task_id: str, role: str, result_summary: str) -> None:
        _background("task_completed", task_id, role)

    @hookimpl
    def on_task_failed(self, task_id: str, role: str, error: str) -> None:
        _background("task_failed", task_id, role)
`;
}
