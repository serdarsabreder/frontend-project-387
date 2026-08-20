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
