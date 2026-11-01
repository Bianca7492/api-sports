/** Minimal JSON -> YAML for the generated documents (no dependency). */
export function toYaml(value, indent = 0) {
  const pad = "  ".repeat(indent);
  if (value === null) return "null";
  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    return value
      .map((v) => {
        const rendered = toYaml(v, indent + 1);
        return `\n${pad}- ${rendered.trimStart()}`;
      })
      .join("");
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (!keys.length) return "{}";
    return keys
      .map((k) => {
        const v = value[k];
        if (v !== null && typeof v === "object") {
          const body = toYaml(v, indent + 1);
          const inline = body.startsWith("\n") ? body : ` ${body}`;
          return `\n${pad}${k}:${inline}`;
        }
        return `\n${pad}${k}: ${toYaml(v, indent)}`;
      })
      .join("");
  }
  if (typeof value === "string") {
    if (value === "" || /[:#\-{}[\],&*?|<>=!%@`"']/.test(value) || value.trim() !== value || value.includes("\n")) {
      return JSON.stringify(value);
    }
    return value;
  }
  return String(value);
}
