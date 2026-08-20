import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Globe, Lock, Video } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { listSlots, type EventType, type Owner, type Slot } from '../api';
import { formatTime, localDateString, timezone } from '../lib/format';
import { cn } from '../lib/utils';
import BookingDialog from './BookingDialog';

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Day {
  date: string;
  weekday: number; // 0 = Sun .. 6 = Sat
  number: number;
  daySlots: Slot[];
}

interface BookingPageProps {
  eventType: EventType;
  owner: Owner;
  onBack: () => void;
}

export default function BookingPage({ eventType, owner, onBack }: BookingPageProps) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [bookingSlot, setBookingSlot] = useState<Slot | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSlots(eventType.id);
      setSlots(data.slots);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [eventType.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Group slots by LOCAL calendar date so the grid lines up with the browser timezone.
  const days = useMemo<Day[]>(() => {
    const byDate = new Map<string, Slot[]>();
    for (const slot of slots) {
      const date = localDateString(new Date(slot.start));
      const list = byDate.get(date) ?? [];
      list.push(slot);
      byDate.set(date, list);
    }
    return [...byDate.entries()]
      .map(([date, daySlots]) => {
        const d = new Date(`${date}T00:00:00`);
        return {
          date,
          weekday: d.getDay(),
          number: d.getDate(),
          daySlots: daySlots.sort((a, b) => a.start.localeCompare(b.start)),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [slots]);

  const today = useMemo(() => localDateString(new Date()), []);
  const selected = days.find((d) => d.date === selectedDate) ?? days[0] ?? null;

  useEffect(() => {
    if (days.length > 0 && !days.some((d) => d.date === selectedDate)) {
      setSelectedDate(days[0].date);
    }
  }, [days, selectedDate]);

  const grid = useMemo(() => {
    if (days.length === 0) return [];
    const leadingEmpty = (days[0].weekday + 6) % 7; // Monday-based offset
    const cells: ({ empty: true; key: string } | { empty?: false; day: Day; key: string })[] = [];
    for (let i = 0; i < leadingEmpty; i += 1) cells.push({ empty: true, key: `lead-${i}` });
    for (const day of days) cells.push({ day, key: day.date });
    while (cells.length % 7 !== 0) cells.push({ empty: true, key: `trail-${cells.length}` });
    return cells;
  }, [days]);

  const handleBooked = useCallback(() => {
    setBookingSlot(null);
    void reload();
  }, [reload]);

  return (
    <Card className="w-full rounded-[24px]">
      <CardContent className="p-6 sm:p-8">
        <Button type="button" variant="ghost" className="-ml-2 mb-4 px-2 text-muted-foreground" onClick={onBack}>
          ← All meeting types
        </Button>

        <div className="mb-6 flex flex-col gap-4 pt-2">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
            {owner.name}
            <Badge variant="secondary">{eventType.name}</Badge>
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-4" /> {eventType.durationMinutes}m
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Video className="size-4" /> Online
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0f4f8] px-3 py-1 text-xs font-semibold text-foreground">
              <Globe className="size-3.5" /> {timezone()}
            </span>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((label) => (
            <span key={label} className="pb-2 text-center text-[11px] font-semibold text-muted-foreground/60">
              {label}
            </span>
          ))}
          {grid.map((cell) =>
            cell.empty ? (
              <span key={cell.key} className="invisible py-2 text-center text-sm" />
            ) : (
              <button
                key={cell.key}
                type="button"
                onClick={() => setSelectedDate(cell.day.date)}
                aria-pressed={cell.day.date === selected?.date}
                className={cn(
                  'rounded-full border py-2 text-center text-sm font-medium transition-colors',
                  cell.day.date === today
                    ? 'border-transparent bg-foreground font-semibold text-background'
                    : cell.day.date === selected?.date
                      ? 'border-primary text-primary'
                      : 'border-border hover:bg-muted',
                )}
              >
                {cell.day.number}
              </button>
            ),
          )}
        </div>

        <Separator className="my-6" />

        {loading ? (
          <p className="text-muted-foreground">Loading available times…</p>
        ) : !selected ? (
          <p className="text-muted-foreground">No available slots in the next 14 days.</p>
        ) : (
          <div className="flex gap-6">
            <div className="flex w-24 shrink-0 flex-col gap-2 pt-2">
              <span className="text-base font-semibold">{WEEKDAY_NAMES[selected.weekday]}</span>
              <span className="text-5xl font-bold leading-none">{String(selected.number).padStart(2, '0')}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {selected.daySlots.map((slot) => {
                const taken = slot.status === 'booked';
                return (
                  <button
                    key={slot.id}
                    type="button"
                    data-testid={slot.id}
                    disabled={taken}
                    onClick={() => setBookingSlot(slot)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl border border-border px-4 py-3.5 text-left transition-colors',
                      taken ? 'cursor-not-allowed bg-muted/40' : 'hover:bg-muted/50',
                    )}
                  >
                    <span className={cn('text-[15px] font-semibold', taken && 'text-muted-foreground/70 line-through')}>
                      {formatTime(slot.start)}
                    </span>
                    <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
                      {taken ? <Lock className="size-3.5" /> : <span className="size-1.5 rounded-full bg-border" />}
                      <span className="rounded-full bg-[#eef2f6] px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        {eventType.durationMinutes}m
                      </span>
                    </span>
                  </button>
                );
              })}
              {selected.daySlots.length === 0 && <p className="text-muted-foreground">No times available on this day.</p>}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="justify-center gap-2 border-t py-4 text-sm font-semibold text-muted-foreground">
        <span className="flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-[10px] font-bold text-white">
          CB
        </span>
        Call Booking
      </CardFooter>

      <BookingDialog
        slot={bookingSlot}
        eventType={eventType}
        onOpenChange={(open) => {
          if (!open) setBookingSlot(null);
        }}
        onBooked={handleBooked}
      />
    </Card>
  );
}
