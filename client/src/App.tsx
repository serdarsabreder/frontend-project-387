import { useCallback, useEffect, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { getOwner, listEventTypes, type EventType, type Owner } from './api';
import BookingPage from './components/BookingPage';
import OwnerView from './components/OwnerView';
import TypesPage from './components/TypesPage';
import { cn } from './lib/utils';

type View = 'types' | 'book' | 'owner';

interface TabProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function Tab({ active, onClick, children }: TabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

export default function App() {
  const [view, setView] = useState<View>('types');
  const [eventType, setEventType] = useState<EventType | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [ownerData, typesData] = await Promise.all([getOwner(), listEventTypes()]);
      setOwner(ownerData);
      setEventTypes(typesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshTypes = useCallback(async () => {
    try {
      setEventTypes(await listEventTypes());
    } catch {
      // Keep the current list; the initial load already surfaced errors.
    }
  }, []);

  const openTypes = () => {
    setEventType(null);
    setView('types');
    void refreshTypes();
  };

  const openOwner = () => {
    setView('owner');
    setEventType(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f7fa] text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border/60 bg-white px-8 py-3.5">
        <div className="flex items-center gap-2.5 font-bold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 text-sm text-white">
            CB
          </span>
          <span>Call Booking</span>
        </div>
        <nav className="flex gap-1 rounded-lg bg-[#f5f7fa] p-1">
          <Tab active={view === 'types' || view === 'book'} onClick={openTypes}>
            Book a call
          </Tab>
          <Tab active={view === 'owner'} onClick={openOwner}>
            Owner
          </Tab>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {error && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span>{error}</span>
            <button
              type="button"
              className="font-semibold underline underline-offset-2"
              onClick={() => void load()}
            >
              Retry
            </button>
          </div>
        )}
        {view === 'types' && (
          <TypesPage
            eventTypes={eventTypes}
            onSelect={(et) => {
              setEventType(et);
              setView('book');
            }}
          />
        )}
        {view === 'book' && eventType && owner && (
          <BookingPage eventType={eventType} owner={owner} onBack={openTypes} />
        )}
        {view === 'owner' && <OwnerView />}
      </main>

      <Toaster position="bottom-center" />
    </div>
  );
}
