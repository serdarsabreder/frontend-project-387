export interface Owner {
  id: string;
  name: string;
}

export interface EventType {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
}

export type SlotStatus = 'available' | 'booked';

export interface Slot {
  id: string;
  eventTypeId: string;
  date: string;
  start: string;
  end: string;
  status: SlotStatus;
}

export interface SlotsResponse {
  eventTypeId: string;
  date?: string;
  slots: Slot[];
}

export interface Booking {
  id: string;
  eventTypeId: string;
  slotId: string;
  start: string;
  end: string;
  name: string;
  email?: string;
  createdAt: string;
}

export interface CreateBookingPayload {
  eventTypeId: string;
  slotId: string;
  name: string;
  email?: string;
}

export interface CreateEventTypePayload {
  name: string;
  description?: string;
  durationMinutes: number;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// The API base can be pointed at the real backend (`/api`, proxied by Vite)
// or at a Prism mock server during development (VITE_API_BASE=http://localhost:4010).
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

const OWNER_TOKEN_KEY = 'call-booking-owner-token';

/** Owner token used when the server runs with OWNER_TOKEN configured. */
export function getOwnerToken(): string {
  try {
    return sessionStorage.getItem(OWNER_TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setOwnerToken(token: string): void {
  try {
    if (token) sessionStorage.setItem(OWNER_TOKEN_KEY, token);
    else sessionStorage.removeItem(OWNER_TOKEN_KEY);
  } catch {
    // Storage can be unavailable (private mode); the header simply stays empty.
  }
}

function ownerHeaders(): Record<string, string> {
  const token = getOwnerToken();
  return token ? { 'x-owner-token': token } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    });
  } catch {
    throw new Error('Cannot reach the server. Is it running?');
  }

  if (res.status === 204) return undefined as T;

  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    throw new ApiError(data?.error ?? 'Something went wrong.', res.status);
  }
  return data as T;
}

export function getOwner(): Promise<Owner> {
  return request<Owner>('/owner');
}

export function listEventTypes(): Promise<EventType[]> {
  return request<EventType[]>('/event-types');
}

export function createEventType(payload: CreateEventTypePayload): Promise<EventType> {
  return request<EventType>('/event-types', {
    method: 'POST',
    headers: ownerHeaders(),
    body: JSON.stringify(payload),
  });
}

export function listSlots(eventTypeId: string, date?: string): Promise<SlotsResponse> {
  const qs = date ? `&date=${encodeURIComponent(date)}` : '';
  return request<SlotsResponse>(`/slots?eventTypeId=${encodeURIComponent(eventTypeId)}${qs}`);
}

export function createBooking(payload: CreateBookingPayload): Promise<Booking> {
  return request<Booking>('/bookings', { method: 'POST', body: JSON.stringify(payload) });
}

export function listBookings(): Promise<Booking[]> {
  return request<Booking[]>('/bookings', { headers: ownerHeaders() });
}

export function deleteBooking(id: string): Promise<void> {
  return request<void>(`/bookings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: ownerHeaders(),
  });
}

/**
 * Deletes an event type. Without `force` the server rejects the request with 409
 * while the type still has bookings, so callers must confirm the cascade first.
 */
export function deleteEventType(id: string, force = false): Promise<void> {
  const qs = force ? '?force=true' : '';
  return request<void>(`/event-types/${encodeURIComponent(id)}${qs}`, {
    method: 'DELETE',
    headers: ownerHeaders(),
  });
}
