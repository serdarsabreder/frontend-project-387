import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { EventType } from '../api';

interface TypesPageProps {
  eventTypes: EventType[];
  onSelect: (eventType: EventType) => void;
}

export default function TypesPage({ eventTypes, onSelect }: TypesPageProps) {
  return (
    <Card className="w-full rounded-[24px]">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Book a call</CardTitle>
        <p className="text-sm text-muted-foreground">Choose a meeting type to see available times.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {eventTypes.map((eventType) => (
          <Button
            key={eventType.id}
            type="button"
            variant="outline"
            className="h-auto justify-between gap-4 rounded-xl px-4 py-4 text-left"
            onClick={() => onSelect(eventType)}
          >
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold">{eventType.name}</span>
              {eventType.description && (
                <span className="text-sm font-normal text-muted-foreground">{eventType.description}</span>
              )}
            </span>
            <Badge variant="secondary" className="shrink-0">
              {eventType.durationMinutes} min
            </Badge>
          </Button>
        ))}
        {eventTypes.length === 0 && <p className="text-sm text-muted-foreground">No meeting types yet.</p>}
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
