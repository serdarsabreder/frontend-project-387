import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  createEventType,
  listBookings,
  listEventTypes,
  type Booking,
  type EventType,
} from '../api';
import { formatTime, localDateString } from '../lib/format';

interface FormState {
  name: string;
  description: string;
  durationMinutes: string;
}

export default function OwnerView() {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [form, setForm] = useState<FormState>({ name: '', description: '', durationMinutes: '30' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [types, meetings] = await Promise.all([listEventTypes(), listBookings()]);
      setEventTypes(types);
      setBookings(meetings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const created = await createEventType({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        durationMinutes: Number(form.durationMinutes),
      });
      toast.success(`Event type "${created.name}" created.`);
      setForm({ name: '', description: '', durationMinutes: '30' });
      void reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  const typeName = (id: string) => eventTypes.find((et) => et.id === id)?.name ?? `#${id}`;

  return (
    <Card className="w-full rounded-[24px]">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Owner dashboard</CardTitle>
        <p className="text-sm text-muted-foreground">Create meeting types and review upcoming meetings.</p>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold">Meeting types</h2>
          <form onSubmit={(e) => void handleCreate(e)} className="flex flex-wrap items-end gap-2">
            <div className="grid min-w-40 flex-1 gap-1.5">
              <Label htmlFor="type-name" className="sr-only">Name</Label>
              <Input
                id="type-name"
                placeholder="Name (e.g. 30 Min Meeting)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="grid min-w-40 flex-1 gap-1.5">
              <Label htmlFor="type-desc" className="sr-only">Description</Label>
              <Input
                id="type-desc"
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid w-28 gap-1.5">
              <Label htmlFor="type-duration" className="sr-only">Duration in minutes</Label>
              <Input
                id="type-duration"
                type="number"
                min={1}
                max={480}
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                aria-label="Duration in minutes"
              />
            </div>
            <Button type="submit">Create type</Button>
          </form>
          {eventTypes.length > 0 && (
            <ul className="flex flex-col">
              {eventTypes.map((et) => (
                <li
                  key={et.id}
                  className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 last:border-b-0"
                >
                  <span className="text-[15px] font-medium">{et.name}</span>
                  <Badge variant="secondary">{et.durationMinutes} min</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Separator />

        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold">Upcoming meetings</h2>
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && bookings.length === 0 && (
            <p className="text-sm text-muted-foreground">No upcoming meetings yet.</p>
          )}
          {!loading && bookings.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="font-medium">{localDateString(new Date(b.start))}</div>
                      <div className="text-muted-foreground">
                        {formatTime(b.start)} – {formatTime(b.end)}
                      </div>
                    </TableCell>
                    <TableCell>{typeName(b.eventTypeId)}</TableCell>
                    <TableCell>{b.name}</TableCell>
                    <TableCell className="text-muted-foreground">{b.email ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </CardContent>

      <CardFooter className="justify-center gap-2 border-t py-4 text-sm font-semibold text-muted-foreground">
        <span className="flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-[10px] font-bold text-white">
          CB
        </span>
        Call Booking
      </CardFooter>
    </Card>
  );
}
