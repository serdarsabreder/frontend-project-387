import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { createApp } from '../src/app.js';
import { createDb } from '../src/db.js';

export function startServer() {
  const db = createDb(':memory:');
  const app = createApp(db);
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        db,
        server,
        base: `http://127.0.0.1:${port}`,
        async close() {
          await new Promise((done) => server.close(done));
          db.close();
        },
      });
    });
  });
}

// A date inside the 14-day booking window (UTC), a few days ahead.
export function futureDate() {
  const d = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

let ctx;
beforeEach(async () => {
  ctx = await startServer();
});

afterEach(async () => {
  await ctx.close();
});

async function getJson(url) {
  const res = await fetch(url);
  return { status: res.status, body: await res.json() };
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json() };
}

test('GET /api/owner returns the default profile', async () => {
  const { status, body } = await getJson(`${ctx.base}/api/owner`);
  assert.equal(status, 200);
  assert.equal(typeof body.id, 'string');
  assert.equal(typeof body.name, 'string');
});

test('GET /api/event-types lists seeded types with name, description, duration', async () => {
  const { status, body } = await getJson(`${ctx.base}/api/event-types`);
  assert.equal(status, 200);
  assert.ok(body.length >= 2);
  for (const eventType of body) {
    assert.equal(typeof eventType.id, 'string');
    assert.equal(typeof eventType.name, 'string');
    assert.equal(typeof eventType.durationMinutes, 'number');
    assert.ok(eventType.durationMinutes > 0);
  }
});

test('POST /api/event-types creates a type and it appears in the list', async () => {
  const create = await postJson(`${ctx.base}/api/event-types`, {
    name: 'Coffee Chat',
    description: 'Casual 15-minute coffee.',
    durationMinutes: 15,
  });
  assert.equal(create.status, 201);
  assert.equal(create.body.name, 'Coffee Chat');
  assert.equal(create.body.durationMinutes, 15);
  assert.ok(create.body.id);

  const { body } = await getJson(`${ctx.base}/api/event-types`);
  assert.ok(body.some((eventType) => eventType.id === create.body.id));
});

test('POST /api/event-types rejects invalid payloads with 400', async () => {
  const cases = [
    {},
    { name: '', durationMinutes: 30 },
    { name: '  ', durationMinutes: 30 },
    { name: 'X', durationMinutes: 0 },
    { name: 'X', durationMinutes: -5 },
    { name: 'X', durationMinutes: 481 },
    { name: 'X', durationMinutes: '30' },
    { name: 'X', durationMinutes: 30.5 },
  ];
  for (const payload of cases) {
    const { status } = await postJson(`${ctx.base}/api/event-types`, payload);
    assert.equal(status, 400, `expected 400 for ${JSON.stringify(payload)}`);
  }
});

test('GET /api/slots returns a 14-day window of correctly sized slots', async () => {
  const { body: types } = await getJson(`${ctx.base}/api/event-types`);
  const type30 = types.find((eventType) => eventType.durationMinutes === 30);
  const type60 = types.find((eventType) => eventType.durationMinutes === 60);

  for (const eventType of [type30, type60]) {
    const { status, body } = await getJson(`${ctx.base}/api/slots?eventTypeId=${eventType.id}`);
    assert.equal(status, 200);
    assert.equal(body.eventTypeId, eventType.id);

    const dates = new Set(body.slots.map((slot) => slot.date));
    // The booking window is 14 calendar days starting today.  When run late in
    // the UTC day all of today's business-hour slots have already passed and
    // are filtered out, so the response may contain 13 distinct dates instead
    // of 14.  Both values are valid.
    assert.ok(dates.size >= 13 && dates.size <= 14, 'window must span 13–14 distinct dates');

    for (const slot of body.slots) {
      assert.equal(slot.id, slot.start);
      assert.equal(slot.eventTypeId, eventType.id);
      const diff = new Date(slot.end) - new Date(slot.start);
      assert.equal(diff, eventType.durationMinutes * 60 * 1000);
      assert.ok(['available', 'booked'].includes(slot.status));
    }
  }
});

test('GET /api/slots filters by date and validates params', async () => {
  const { body: types } = await getJson(`${ctx.base}/api/event-types`);
  const eventType = types[0];
  const date = futureDate();

  const { status, body } = await getJson(`${ctx.base}/api/slots?eventTypeId=${eventType.id}&date=${date}`);
  assert.equal(status, 200);
  assert.equal(body.date, date);
  assert.ok(body.slots.length > 0);
  assert.ok(body.slots.every((slot) => slot.date === date));

  const bad = await getJson(`${ctx.base}/api/slots?eventTypeId=${eventType.id}&date=2026-02-30`);
  assert.equal(bad.status, 400);

  const missing = await getJson(`${ctx.base}/api/slots?date=${date}`);
  assert.equal(missing.status, 400);

  const unknown = await getJson(`${ctx.base}/api/slots?eventTypeId=99999`);
  assert.equal(unknown.status, 404);
});

test('POST /api/bookings creates a booking and it appears everywhere', async () => {
  const { body: types } = await getJson(`${ctx.base}/api/event-types`);
  const eventType = types.find((eventType) => eventType.durationMinutes === 30);
  const date = futureDate();

  const { body: slots } = await getJson(`${ctx.base}/api/slots?eventTypeId=${eventType.id}&date=${date}`);
  const slot = slots.slots[0];

  const { status, body: booking } = await postJson(`${ctx.base}/api/bookings`, {
    eventTypeId: eventType.id,
    slotId: slot.id,
    name: 'Ada Lovelace',
    email: 'ada@example.com',
  });
  assert.equal(status, 201);
  assert.equal(booking.slotId, slot.id);
  assert.equal(booking.start, slot.id);
  assert.equal(booking.name, 'Ada Lovelace');
  assert.ok(booking.id);
  assert.ok(booking.createdAt);

  const { body: list } = await getJson(`${ctx.base}/api/bookings`);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, booking.id);

  const after = await getJson(`${ctx.base}/api/slots?eventTypeId=${eventType.id}&date=${date}`);
  assert.equal(after.body.slots.find((s) => s.id === slot.id).status, 'booked');
});

test('booking the same slot twice returns 409', async () => {
  const { body: types } = await getJson(`${ctx.base}/api/event-types`);
  const eventType = types.find((eventType) => eventType.durationMinutes === 30);
  const date = futureDate();
  const { body: slots } = await getJson(`${ctx.base}/api/slots?eventTypeId=${eventType.id}&date=${date}`);
  const slot = slots.slots[0];

  const first = await postJson(`${ctx.base}/api/bookings`, {
    eventTypeId: eventType.id,
    slotId: slot.id,
    name: 'Ada',
  });
  assert.equal(first.status, 201);

  const second = await postJson(`${ctx.base}/api/bookings`, {
    eventTypeId: eventType.id,
    slotId: slot.id,
    name: 'Grace',
  });
  assert.equal(second.status, 409);
  assert.equal(second.body.error, 'This time slot is already reserved.');
});

test('overlapping bookings across different event types return 409', async () => {
  const { body: types } = await getJson(`${ctx.base}/api/event-types`);
  const type30 = types.find((eventType) => eventType.durationMinutes === 30);
  const type60 = types.find((eventType) => eventType.durationMinutes === 60);
  const date = futureDate();

  const { body: slots60 } = await getJson(`${ctx.base}/api/slots?eventTypeId=${type60.id}&date=${date}`);
  const longSlot = slots60.slots[0]; // e.g. 09:00–10:00
  const longStart = new Date(longSlot.start);

  // Book a 60-minute meeting.
  const first = await postJson(`${ctx.base}/api/bookings`, {
    eventTypeId: type60.id,
    slotId: longSlot.id,
    name: 'Ada',
  });
  assert.equal(first.status, 201);

  // A 30-minute slot starting 30 minutes into that meeting overlaps -> 409.
  const overlapStart = new Date(longStart.getTime() + 30 * 60 * 1000).toISOString();
  const overlap = await postJson(`${ctx.base}/api/bookings`, {
    eventTypeId: type30.id,
    slotId: overlapStart,
    name: 'Grace',
  });
  assert.equal(overlap.status, 409);

  // A 30-minute slot starting right after the meeting does not overlap -> 201.
  const nextStart = new Date(longStart.getTime() + 60 * 60 * 1000).toISOString();
  const ok = await postJson(`${ctx.base}/api/bookings`, {
    eventTypeId: type30.id,
    slotId: nextStart,
    name: 'Linus',
  });
  assert.equal(ok.status, 201);
});

test('POST /api/bookings rejects invalid payloads with 400', async () => {
  const { body: types } = await getJson(`${ctx.base}/api/event-types`);
  const eventType = types[0];
  const date = futureDate();
  const { body: slots } = await getJson(`${ctx.base}/api/slots?eventTypeId=${eventType.id}&date=${date}`);
  const slot = slots.slots[0];

  const cases = [
    {},
    { eventTypeId: eventType.id, slotId: slot.id },
    { eventTypeId: eventType.id, slotId: slot.id, name: '   ' },
    { eventTypeId: eventType.id, slotId: slot.id, name: 'Ada', email: 'not-an-email' },
    { eventTypeId: eventType.id, slotId: '2020-01-01T09:00:00.000Z', name: 'Ada' },
    { eventTypeId: eventType.id, slotId: 'not-a-slot', name: 'Ada' },
  ];

  for (const payload of cases) {
    const { status } = await postJson(`${ctx.base}/api/bookings`, payload);
    assert.equal(status, 400, `expected 400 for ${JSON.stringify(payload)}`);
  }
});

test('POST /api/bookings returns 404 for unknown event type or unknown slot', async () => {
  const { body: types } = await getJson(`${ctx.base}/api/event-types`);
  const eventType = types[0];

  const unknownType = await postJson(`${ctx.base}/api/bookings`, {
    eventTypeId: '99999',
    slotId: '2099-01-01T09:00:00.000Z',
    name: 'Ada',
  });
  assert.equal(unknownType.status, 404);

  const outside = await postJson(`${ctx.base}/api/bookings`, {
    eventTypeId: eventType.id,
    slotId: `${futureDate()}T06:00:00.000Z`,
    name: 'Ada',
  });
  assert.equal(outside.status, 404);
});

test('GET /api/bookings only lists upcoming meetings', async () => {
  const { body: types } = await getJson(`${ctx.base}/api/event-types`);
  const eventType = types[0];
  const date = futureDate();
  const { body: slots } = await getJson(`${ctx.base}/api/slots?eventTypeId=${eventType.id}&date=${date}`);

  for (let i = 0; i < 3; i += 1) {
    const { status } = await postJson(`${ctx.base}/api/bookings`, {
      eventTypeId: eventType.id,
      slotId: slots.slots[i].id,
      name: `Guest ${i}`,
    });
    assert.equal(status, 201);
  }

  const { body } = await getJson(`${ctx.base}/api/bookings`);
  assert.equal(body.length, 3);
  assert.deepEqual(
    body.map((booking) => booking.name),
    ['Guest 0', 'Guest 1', 'Guest 2'],
  );
  assert.ok(body.every((booking) => new Date(booking.start) > new Date()));
});
