import { createApp } from './app.js';
import { createDb } from './db.js';

// The server reads PORT from the environment and binds to 0.0.0.0 so the
// process runs identically on a host and inside the Docker container.
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';

const db = createDb();
const app = createApp(db);

app.listen(port, host, () => {
  console.log(`Call Booking server listening on http://${host}:${port}`);
});
