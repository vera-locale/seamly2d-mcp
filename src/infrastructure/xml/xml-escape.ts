export function escapeXmlAttr(value: string | number): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function escapeXmlText(value: string | number): string {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function formatAttrs(attrs: ReadonlyArray<readonly [string, string | number]>): string {
  return attrs.map(([key, val]) => `${key}="${escapeXmlAttr(val)}"`).join(' ');
}
