import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bookingsRouter } from './routes/bookings.js';
import { eventTypesRouter } from './routes/eventTypes.js';
import { ownerRouter } from './routes/owner.js';
import { slotsRouter } from './routes/slots.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');

export function createApp(db) {
  const app = express();
  app.use(express.json());

  app.use('/api/owner', ownerRouter());
  app.use('/api/event-types', eventTypesRouter(db));
  app.use('/api/slots', slotsRouter(db));
  app.use('/api/bookings', bookingsRouter(db));

  // Serve the built React client when present (production / Docker).
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      return res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  // JSON 404 for unknown API routes.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found.' });
  });

  // Central error handler.
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}
