import { expect, test } from '@playwright/test';

const API = '/api';

async function firstAvailableSlot(request: import('@playwright/test').APIRequestContext, eventTypeId = '1') {
  const res = await request.get(`${API}/slots?eventTypeId=${eventTypeId}`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { slots: { id: string; status: string }[] };
  const slot = body.slots.find((s) => s.status === 'available');
  expect(slot).toBeTruthy();
  return slot!.id;
}

test('guest can book a call end to end', async ({ page }) => {
  await page.goto('/');

  // Landing page lists the meeting types.
  const typeButton = page.getByRole('button', { name: /30 Min Meeting/ });
  await expect(typeButton).toBeVisible();
  await typeButton.click();

  // Booking page shows the owner, the event meta and the slot list.
  await expect(page.getByRole('heading', { name: /Kirill Mokevnin/ })).toBeVisible();
  await expect(page.getByText('Online')).toBeVisible();

  // Pick the first free time slot.
  const freeSlot = page.locator('button:not([disabled])[data-testid]').first();
  await expect(freeSlot).toBeVisible();
  const slotId = await freeSlot.getAttribute('data-testid');
  expect(slotId).toBeTruthy();
  await freeSlot.click();

  // Fill the booking dialog and confirm.
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Your name').fill('Ada Lovelace');
  await dialog.getByLabel(/Email/).fill('ada@example.com');
  await dialog.getByRole('button', { name: 'Confirm booking' }).click();

  // Success toast appears and the slot turns greyed out.
  await expect(page.getByText(/Booked!/)).toBeVisible();
  await expect(page.getByTestId(slotId!)).toBeDisabled();
});

test('a taken slot is shown as unavailable', async ({ page, request }) => {
  // Simulate another guest booking a slot through the API.
  const slotId = await firstAvailableSlot(request);
  const res = await request.post(`${API}/bookings`, {
    data: { eventTypeId: '1', slotId, name: 'Grace Hopper' },
  });
  expect(res.status()).toBe(201);

  await page.goto('/');
  await page.getByRole('button', { name: /30 Min Meeting/ }).click();

  await expect(page.getByTestId(slotId)).toBeDisabled();
});

test('booking the same slot twice returns 409', async ({ request }) => {
  const slotId = await firstAvailableSlot(request);

  const first = await request.post(`${API}/bookings`, {
    data: { eventTypeId: '1', slotId, name: 'Grace Hopper' },
  });
  expect(first.status()).toBe(201);

  const second = await request.post(`${API}/bookings`, {
    data: { eventTypeId: '1', slotId, name: 'Second Guest' },
  });
  expect(second.status()).toBe(409);
  const body = (await second.json()) as { error: string };
  expect(body.error).toBe('This time slot is already reserved.');
});

test('shows an empty state when the API returns no slots', async ({ page }) => {
  // Fulfill every availability lookup for this type with an empty slot list,
  // simulating a fully booked 14-day window straight from the API.
  await page.route('**/api/slots*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('eventTypeId') !== '1') {
      await route.continue();
      return;
    }
    await route.fulfill({ json: { eventTypeId: '1', slots: [] } });
  });

  await page.goto('/');
  await page.getByRole('button', { name: /30 Min Meeting/ }).click();

  // The friendly empty-state card replaces the slot list.
  await expect(page.getByText('Fully booked for now')).toBeVisible();
  await expect(page.getByText(/has no open times in the next 14 days\. Please check back soon!/)).toBeVisible();

  // No bookable time buttons are rendered.
  await expect(page.locator('button[data-testid]')).toHaveCount(0);
});

test('owner can cancel an upcoming booking', async ({ page, request }) => {
  const slotId = await firstAvailableSlot(request);
  const created = await request.post(`${API}/bookings`, {
    data: { eventTypeId: '1', slotId, name: 'Cancel Me' },
  });
  expect(created.status()).toBe(201);

  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await page.getByRole('button', { name: 'Owner' }).click();

  const row = page.getByRole('row', { name: /Cancel Me/ });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByText('Booking cancelled.')).toBeVisible();
  await expect(page.getByRole('row', { name: /Cancel Me/ })).toHaveCount(0);
});

test('deleting an event type asks before cancelling its bookings', async ({ page, request }) => {
  const created = await request.post(`${API}/event-types`, {
    data: { name: 'Temporary Type', durationMinutes: 15 },
  });
  expect(created.status()).toBe(201);
  const eventType = (await created.json()) as { id: string };

  const slotsRes = await request.get(`${API}/slots?eventTypeId=${eventType.id}`);
  const { slots } = (await slotsRes.json()) as { slots: { id: string; status: string }[] };
  const freeSlot = slots.find((slot) => slot.status === 'available');
  expect(freeSlot).toBeTruthy();
  const booked = await request.post(`${API}/bookings`, {
    data: { eventTypeId: eventType.id, slotId: freeSlot!.id, name: 'Booked Guest' },
  });
  expect(booked.status()).toBe(201);

  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.accept();
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Owner' }).click();

  const item = page.getByRole('listitem').filter({ hasText: 'Temporary Type' });
  await expect(item).toBeVisible();
  await item.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByText(/Event type "Temporary Type" deleted/)).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Temporary Type' })).toHaveCount(0);
  // The second confirmation must call out the bookings that would be cancelled.
  expect(dialogs.some((message) => /booking/i.test(message))).toBe(true);
});

test.describe('timezone handling', () => {
  test.use({ timezoneId: 'Australia/Sydney' });

  test('groups a slot under the guest-local day, not the UTC day', async ({ page }) => {
    // 18:00 UTC on Nov 12 is 05:00 on Nov 13 in Sydney.
    await page.route('**/api/slots*', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('eventTypeId') !== '1') {
        await route.continue();
        return;
      }
      await route.fulfill({
        json: {
          eventTypeId: '1',
          slots: [
            {
              id: '2026-11-12T18:00:00.000Z',
              eventTypeId: '1',
              date: '2026-11-12',
              start: '2026-11-12T18:00:00.000Z',
              end: '2026-11-12T18:30:00.000Z',
              status: 'available',
            },
          ],
        },
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: /30 Min Meeting/ }).click();

    // The day panel and grid must use Nov 13 (local), and the time must be local.
    await expect(page.getByText('Fri', { exact: true })).toBeVisible();
    await expect(page.getByText('13', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '12', exact: true })).toHaveCount(0);
    await expect(page.getByText(/05:00/)).toBeVisible();
  });
});

test('owner can create an event type', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Owner' }).click();
  await expect(page.getByText('Owner dashboard')).toBeVisible();

  await page.getByPlaceholder('Name (e.g. 30 Min Meeting)').fill('Quick Check-in');
  await page.getByPlaceholder('Description (optional)').fill('A short sync.');
  await page.getByLabel('Duration in minutes').fill('15');
  await page.getByRole('button', { name: 'Create type' }).click();

  await expect(page.getByText(/Event type "Quick Check-in" created/)).toBeVisible();
  await expect(page.getByText('Quick Check-in').first()).toBeVisible();

  // The new type also appears on the guest page.
  await page.getByRole('button', { name: 'Book a call' }).click();
  await expect(page.getByRole('button', { name: /Quick Check-in/ })).toBeVisible();
});
