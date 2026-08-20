import "@typespec/http";
import "@typespec/openapi3";
import "@typespec/versioning";

using TypeSpec.Http;
using TypeSpec.Versioning;

@service(#{
  title: "Call Booking",
})
@server("/api", "The Call Booking API is mounted under the /api prefix.")
@versioned(Versions)
@doc("""
  Design First contract for the Call Booking service, a Cal.com-style time-booking
  application. This TypeSpec file is the single source of truth; the OpenAPI
  specification (api-contract.yaml) is generated from it.

  Roles (no registration or authorization):
  - calendar owner — a single predefined profile, used by default in the admin part.
  - guest — books slots without creating an account.

  Booking rules:
  - Available slots are generated for the next 14 days starting from today
    (the booking window), on a 30-minute grid within business hours 09:00–18:00 UTC.
  - A slot's duration comes from its event type.
  - Occupancy is global: two bookings cannot overlap in time, even when they are
    for different event types. A booking attempt that overlaps an existing booking
    is rejected with 409 Conflict.
  """)
namespace CallBooking {
  /** API versions of the Call Booking contract. */
  enum Versions {
    v1_0_0: "1.0.0",
  }

  // ---------------------------------------------------------------------------
  // Domain entities
  // ---------------------------------------------------------------------------

  /** The single predefined calendar owner profile used by the admin part. */
  model Owner {
    /** Stable identifier of the owner profile. */
    id: string;
    /** Display name shown in the admin part. */
    name: string;
  }

  /** A meeting shape published by the owner, with a fixed duration in minutes. */
  model EventType {
    /** Unique identifier of the event type. */
    id: string;
    /** Short name shown to guests, e.g. "Intro call". */
    name: string;
    /** Longer description shown on the booking types page. */
    description?: string;
    /** Meeting length in minutes; determines the end of every generated slot. */
    durationMinutes: int32;
  }

  /** Availability state of a generated slot. */
  enum SlotStatus {
    /** Still free to book. */
    available,
    /** Some booking overlaps this slot's interval (across all event types). */
    booked,
  }

  /** A single bookable time slot for an event type inside the 14-day window. */
  model Slot {
    /** Stable identifier, derived from the slot's UTC start time. */
    id: string;
    /** The event type this slot belongs to. */
    eventTypeId: string;
    /** The calendar day in YYYY-MM-DD (UTC). */
    date: plainDate;
    /** Start of the slot in ISO 8601 (UTC). */
    start: utcDateTime;
    /** End of the slot in ISO 8601 (UTC), start + event type duration. */
    end: utcDateTime;
    /** Whether the slot is still free to book. */
    status: SlotStatus;
  }

  /** The response of the slot listing endpoint. */
  model SlotsResponse {
    /** The event type the slots were generated for. */
    eventTypeId: string;
    /** The requested date, when a single day was asked for. */
    date?: plainDate;
    /** Slots, ordered by start time. */
    slots: Slot[];
  }

  /** A booking links a guest to a slot interval for an event type. */
  model Booking {
    /** Unique identifier of the booking. */
    id: string;
    /** The event type that was booked. */
    eventTypeId: string;
    /** The id of the booked slot (its UTC start time). */
    slotId: string;
    /** Start of the meeting in ISO 8601 (UTC). */
    start: utcDateTime;
    /** End of the meeting in ISO 8601 (UTC). */
    end: utcDateTime;
    /** Name of the guest who booked. */
    name: string;
    /** Optional guest email for follow-up. */
    @format("email")
    email?: string;
    /** When the booking was created in ISO 8601 (UTC). */
    createdAt: utcDateTime;
  }

  // ---------------------------------------------------------------------------
  // Request / error payloads
  // ---------------------------------------------------------------------------

  /** Payload for creating an event type (owner action). */
  model CreateEventTypeRequest {
    /** Short name shown to guests, e.g. "Intro call". */
    @minLength(1)
    name: string;
    /** Longer description shown on the booking types page. */
    description?: string;
    /** Meeting length in minutes; must be a positive integer. */
    @minValue(1)
    @maxValue(480)
    durationMinutes: int32;
  }

  /** Payload for booking a slot (guest action). */
  model CreateBookingRequest {
    /** The event type the guest selected. */
    eventTypeId: string;
    /** The id of the free slot to book, as returned by GET /slots. */
    slotId: string;
    /** Name of the guest booking the call. */
    @minLength(1)
    name: string;
    /** Optional guest email for follow-up. */
    @format("email")
    email?: string;
  }

  /** Standard error envelope returned by every non-2xx response. */
  model Error {
    /** Human-readable description of what went wrong. */
    error: string;
  }

  // ---------------------------------------------------------------------------
  // Status code helpers
  // ---------------------------------------------------------------------------

  model BadRequest {
    @statusCode _: 400;
    @body body: Error;
  }

  model NotFound {
    @statusCode _: 404;
    @body body: Error;
  }

  model Conflict {
    @statusCode _: 409;
    @body body: Error;
  }

  model CreatedEventType {
    @statusCode _: 201;
    @body body: EventType;
  }

  model CreatedBooking {
    @statusCode _: 201;
    @body body: Booking;
  }

  // ---------------------------------------------------------------------------
  // Endpoints
  // ---------------------------------------------------------------------------

  /** Owner profile: the single predefined calendar owner used by the admin part. */
  @route("/owner")
  interface OwnerResource {
    @get
    @doc("Return the default calendar owner profile.")
    get(): Owner;
  }

  /**
   * Event types published by the owner. Guests read them to pick a meeting shape;
   * the owner's admin page uses the same listing plus the create operation.
   */
  @route("/event-types")
  interface EventTypesResource {
    @get
    @doc("List all published event types (id, name, description, duration).")
    list(): EventType[];

    @post
    @doc("Create a new event type. Owner-only action (no auth in this project).")
    create(@body body: CreateEventTypeRequest): CreatedEventType | BadRequest;
  }

  /** Availability: generated slots for an event type inside the 14-day window. */
  @route("/slots")
  interface SlotsResource {
    @get
    @doc("""
      List the slots for an event type.

      Slots are generated for the next 14 days (booking window) on a 30-minute grid
      within business hours 09:00–18:00 UTC. A slot is marked `booked` when an
      existing booking overlaps its interval, across all event types. Pass `date` to
      restrict the response to a single day (YYYY-MM-DD); otherwise the whole
      window is returned.
      """)
    list(
      /** The event type to generate slots for. */
      @query eventTypeId: string,
      /** Optional single day (YYYY-MM-DD) to filter on. */
      @query date?: plainDate,
    ): SlotsResponse | BadRequest | NotFound;
  }

  /** Bookings: the guest creates them, the owner reviews them all in one list. */
  @route("/bookings")
  interface BookingsResource {
    @get
    @doc("List upcoming meetings across all event types, ordered by start time.")
    list(): Booking[];

    @post
    @doc("""
      Book a free slot for a guest.

      The slot interval is derived from the event type duration. The booking is
      rejected with 409 Conflict when any existing booking overlaps that interval
      (the occupancy rule applies across event types).
      """)
    create(@body body: CreateBookingRequest): CreatedBooking | BadRequest | NotFound | Conflict;
  }
}
