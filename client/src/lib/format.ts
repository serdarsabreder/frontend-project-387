export function localDateString(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const options = { weekday: 'long', day: 'numeric', month: 'long' } as const;
  return `${start.toLocaleDateString([], options)} · ${formatTime(startIso)} – ${formatTime(endIso)}`;
}

export function timezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'Local time';
  }
}
