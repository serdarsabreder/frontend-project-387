# User Scenarios (E2E)

End-to-end scenarios exercised by Playwright in `e2e/tests`. Each scenario
starts the real backend (`server`) and the real frontend (`client`) and drives
the browser like a user would.

## Scenario 1 — Guest books a call (main booking path)

The core flow, from landing on the page to a confirmed booking.

1. The guest opens the app and sees the list of published meeting types.
2. The guest picks a meeting type (e.g. "30 Min Meeting").
3. The booking page shows the owner, the event-type badge, the duration and
   timezone, a 14-day week grid (today highlighted), and the free time slots
   for the selected day.
4. The guest picks a free time slot.
5. The booking dialog asks for the guest's name and (optional) email.
6. The guest confirms; a success toast appears and the page reloads the
   availability.
7. The just-booked slot now renders as taken (greyed out, disabled).

**Covered by:** `booking.spec.ts › guest can book a call end to end`

## Scenario 2 — An already-taken slot is not bookable

A slot that someone else already booked must stay unavailable.

1. A slot is booked through the API (simulating another guest).
2. The guest opens the booking page for that event type.
3. The taken slot is rendered greyed out and cannot be clicked.

**Covered by:** `booking.spec.ts › a taken slot is shown as unavailable`

## Scenario 3 — Booking an occupied slot is rejected with 409

Backend-level rule: two bookings can never overlap, even across event types.

1. The guest books a slot.
2. A second attempt to book the same (or an overlapping) slot is rejected by
   the API with HTTP `409` and the message "This time slot is already reserved."

**Covered by:** `booking.spec.ts › booking the same slot twice returns 409`

## Scenario 4 — Owner creates a meeting type

The admin part publishes a new meeting type, which then appears for guests.

1. The owner opens the "Owner" view.
2. The owner fills in a name, a description and a duration and creates the type.
3. A success toast confirms the creation and the type appears in the list.
4. The new type is visible on the guest "Book a call" page.

**Covered by:** `booking.spec.ts › owner can create an event type`
