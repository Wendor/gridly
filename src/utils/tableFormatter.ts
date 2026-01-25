export function formatTableValue(val: unknown): string {
  if (val === null || val === undefined) return '(NULL)'
  if (typeof val === 'object') {
    if (val && (val as Record<string, unknown>).__isWrapped) {
      return (val as Record<string, unknown>).display as string
    }
    return JSON.stringify(val)
  }
  return String(val)
}
