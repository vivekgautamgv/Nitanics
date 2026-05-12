// MCP tool response wrappers.
// Every tool returns this shape. Consistent format across all 18 tools.

export function ok(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function err(message: string) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true as const,
  };
}
