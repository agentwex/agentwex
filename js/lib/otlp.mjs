export function attributeValue(value) {
  if (!value || typeof value !== "object") return value;
  for (const key of ["stringValue", "boolValue", "intValue", "doubleValue"]) {
    if (key in value) return key === "intValue" ? String(value[key]) : value[key];
  }
  return undefined;
}

export function attributeMap(attributes = []) {
  if (!Array.isArray(attributes)) return attributes && typeof attributes === "object" ? attributes : {};
  return Object.fromEntries(attributes.map((entry) => [entry.key, attributeValue(entry.value)]).filter((entry) => entry[0]));
}

export function isoFromUnixNano(value) {
  if (value == null) return null;
  const milliseconds = Number(BigInt(String(value)) / 1_000_000n);
  return new Date(milliseconds).toISOString();
}

function normalizeSpan(span, resourceAttributes = {}) {
  if (span?.endTime && typeof span.attributes === "object" && !Array.isArray(span.attributes)) return span;
  const code = span?.status?.code;
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    endTime: isoFromUnixNano(span.endTimeUnixNano),
    status: { code: code === 1 || code === "STATUS_CODE_OK" ? "OK" : code === 2 || code === "STATUS_CODE_ERROR" ? "ERROR" : "UNSET" },
    resource: { attributes: resourceAttributes },
    attributes: attributeMap(span.attributes),
  };
}

export function spansFromOtlpJson(payload) {
  if (Array.isArray(payload?.spans)) return payload.spans.map((span) => normalizeSpan(span));
  const spans = [];
  for (const resourceSpans of payload?.resourceSpans ?? []) {
    const resourceAttributes = attributeMap(resourceSpans.resource?.attributes);
    for (const scopeSpans of resourceSpans.scopeSpans ?? resourceSpans.instrumentationLibrarySpans ?? []) {
      for (const span of scopeSpans.spans ?? []) spans.push(normalizeSpan(span, resourceAttributes));
    }
  }
  return spans;
}
