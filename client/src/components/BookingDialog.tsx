import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, createBooking, type CreateBookingPayload, type EventType, type Slot } from '../api';
import { formatRange } from '../lib/format';

interface BookingDialogProps {
  slot: Slot | null;
  eventType: EventType;
  onOpenChange: (open: boolean) => void;
  onBooked: () => void;
}

export default function BookingDialog({ slot, eventType, onOpenChange, onBooked }: BookingDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slot) {
      setName('');
      setEmail('');
      setError(null);
    }
  }, [slot]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slot || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: CreateBookingPayload = { eventTypeId: eventType.id, slotId: slot.id, name: name.trim() };
      if (email.trim()) payload.email = email.trim();
      await createBooking(payload);
      onBooked();
      toast.success(`Booked! ${eventType.name} scheduled.`);
    } catch (err) {
      // A 409 means the slot was taken while the guest was filling the form,
      // so we surface a friendly message and refresh the availability.
      if (err instanceof ApiError && err.status === 409) {
        onBooked();
        toast.error('This time slot is already reserved. Please pick another one.');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={slot !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{eventType.name}</DialogTitle>
          {slot && <DialogDescription>{formatRange(slot.start, slot.end)}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-2">
            <Label htmlFor="booking-name">Your name</Label>
            <Input
              id="booking-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              required
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="booking-email">
              Email <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="booking-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Booking…' : 'Confirm booking'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
