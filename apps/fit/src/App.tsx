import { Dumbbell } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const defaultUsername = 'friend';

async function fetchGreeting(username: string) {
    const response = await fetch(
        `/hello?username=${encodeURIComponent(username)}`,
    );

    if (!response.ok) {
        throw new Error('Unable to load greeting');
    }

    return response.text();
}

export default function App() {
    const [username, setUsername] = useState(defaultUsername);
    const [draftUsername, setDraftUsername] = useState(defaultUsername);
    const [greeting, setGreeting] = useState(`hello ${defaultUsername}`);
    const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

    useEffect(() => {
        let active = true;

        setStatus('loading');

        fetchGreeting(username)
            .then((nextGreeting) => {
                if (!active) return;

                setGreeting(nextGreeting);
                setStatus('idle');
            })
            .catch(() => {
                if (!active) return;

                setStatus('error');
            });

        return () => {
            active = false;
        };
    }, [username]);

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(244,140,64,0.26),_transparent_30%),linear-gradient(160deg,_hsl(var(--canvas))_0%,_hsl(var(--background))_52%,_hsl(var(--canvas-deep))_100%)] px-6 py-10 text-foreground sm:px-8">
            <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center">
                <Card className="w-full overflow-hidden border-border/70 bg-card/90 shadow-[0_24px_80px_rgba(54,44,36,0.2)] backdrop-blur">
                    <CardHeader className="space-y-6 border-b border-border/60 p-8 sm:p-10">
                        <Badge className="w-fit rounded-full bg-secondary px-4 py-1 text-[0.7rem] uppercase tracking-[0.22em] text-secondary-foreground shadow-none">
                            fit.frk.gg
                        </Badge>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-primary">
                                <div className="rounded-2xl bg-primary/10 p-3">
                                    <Dumbbell className="size-6" />
                                </div>
                                <CardTitle className="font-display text-4xl tracking-[0.08em] sm:text-5xl">
                                    FIT
                                </CardTitle>
                            </div>
                            <p className="max-w-2xl text-balance text-lg leading-8 text-muted-foreground">
                                Welcome to fit, {username}
                            </p>
                        </div>
                    </CardHeader>
                    <CardContent className="grid gap-8 p-8 sm:grid-cols-[1.1fr_0.9fr] sm:p-10">
                        <section className="space-y-4">
                            <label
                                className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground"
                                htmlFor="username"
                            >
                                Username
                            </label>
                            <div className="flex flex-col gap-3 sm:flex-row">
                                <input
                                    className="h-12 flex-1 rounded-2xl border border-input bg-background/80 px-4 text-base outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                                    id="username"
                                    onChange={(event) =>
                                        setDraftUsername(event.target.value)
                                    }
                                    placeholder="Enter a username"
                                    value={draftUsername}
                                />
                                <Button
                                    className="h-12 rounded-2xl px-6"
                                    onClick={() =>
                                        setUsername(
                                            draftUsername.trim() ||
                                                defaultUsername,
                                        )
                                    }
                                    type="button"
                                >
                                    Refresh hello
                                </Button>
                            </div>
                            <p className="text-sm leading-6 text-muted-foreground">
                                The frontend calls the Elysia backend at
                                `/hello`, then shows the current response below.
                            </p>
                        </section>
                        <section className="rounded-[1.75rem] border border-border/70 bg-secondary/50 p-6">
                            <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
                                API response
                            </p>
                            <p className="mt-4 font-mono text-2xl text-foreground">
                                {status === 'error'
                                    ? 'hello unavailable'
                                    : greeting}
                            </p>
                        </section>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
