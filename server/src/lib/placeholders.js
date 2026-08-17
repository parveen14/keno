// Replaces {{token}} placeholders in campaign subject/body with real values at send time,
// so the sent copy (and its email_log snapshot) never carries raw template tokens.
export function resolvePlaceholders(text, tokens) {
  if (!text) return text;
  return text.replace(/{{\s*(\w+)\s*}}/g, (match, key) => (tokens[key] !== undefined ? String(tokens[key]) : ''));
}
