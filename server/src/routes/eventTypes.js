import { Router } from 'express';
import { getEventType, toEventType } from '../event-types.js';

export function eventTypesRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const rows = db
      .prepare('SELECT id, name, description, duration_minutes FROM event_types ORDER BY id ASC')
      .all();
    res.json(rows.map(toEventType));
  });

  router.post('/', (req, res) => {
    const { name, description, durationMinutes } = req.body ?? {};

    if (typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required and must not be empty.' });
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 480) {
      return res.status(400).json({ error: 'durationMinutes must be an integer between 1 and 480.' });
    }
    let cleanDescription = null;
    if (description !== undefined && description !== null) {
      if (typeof description !== 'string') {
        return res.status(400).json({ error: 'description must be a string.' });
      }
      cleanDescription = description.trim() || null;
    }

    const { lastInsertRowid } = db
      .prepare('INSERT INTO event_types (name, description, duration_minutes) VALUES (?, ?, ?)')
      .run(name.trim(), cleanDescription, durationMinutes);

    const row = db
      .prepare('SELECT id, name, description, duration_minutes FROM event_types WHERE id = ?')
      .get(lastInsertRowid);

    res.status(201).json(toEventType(row));
  });

  router.delete('/:id', (req, res) => {
    const { id } = req.params;
    if (typeof id !== 'string' || !/^\d+$/.test(id)) {
      return res.status(404).json({ error: 'Event type not found.' });
    }

    const row = db.prepare('SELECT id FROM event_types WHERE id = ?').get(Number(id));
    if (!row) {
      return res.status(404).json({ error: 'Event type not found.' });
    }

    const hasBookings = db
      .prepare('SELECT 1 FROM bookings WHERE event_type_id = ? LIMIT 1')
      .get(Number(id));

    const deleteAll = db.transaction(() => {
      db.prepare('DELETE FROM bookings WHERE event_type_id = ?').run(Number(id));
      db.prepare('DELETE FROM event_types WHERE id = ?').run(Number(id));
    });
    deleteAll();
    res.status(204).end();
  });

  return router;
}

export { getEventType };
