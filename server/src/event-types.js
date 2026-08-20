// Mapping between the database rows and the EventType shape from the contract.
export function toEventType(row) {
  return {
    id: String(row.id),
    name: row.name,
    ...(row.description ? { description: row.description } : {}),
    durationMinutes: row.duration_minutes,
  };
}

// Look up an event type by its API id (string form), or return null.
export function getEventType(db, eventTypeId) {
  if (typeof eventTypeId !== 'string' || !/^\d+$/.test(eventTypeId)) {
    return null;
  }
  const row = db
    .prepare('SELECT id, name, description, duration_minutes FROM event_types WHERE id = ?')
    .get(Number(eventTypeId));
  return row ? toEventType(row) : null;
}
