import { ArrowUpRight, Github, Linkedin, Lock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
} from '@/components/ui/card';

const authOrigin =
    import.meta.env.VITE_AUTH_ORIGIN ?? 'https://auth.frk.localhost';
const githubUrl =
    import.meta.env.VITE_GITHUB_URL ?? 'https://github.com/itsfrank';
const linkedinUrl =
    import.meta.env.VITE_LINKEDIN_URL ??
    'https://www.linkedin.com/in/frank-obrien/';

function SocialLink({
    href,
    label,
    icon,
}: {
    href: string;
    label: string;
    icon: React.ReactNode;
}) {
    return (
        <a
            className="group flex items-center justify-between rounded-full border border-border/70 bg-background/70 px-4 py-3 text-sm font-medium text-foreground transition hover:-translate-y-0.5 hover:border-foreground/30 hover:bg-background"
            href={href}
            rel="noreferrer"
            target="_blank"
        >
            <span className="flex items-center gap-3">
                <span className="text-muted-foreground transition group-hover:text-foreground">
                    {icon}
                </span>
                {label}
            </span>
            <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:text-foreground" />
        </a>
    );
}

export default function App() {
    return (
        <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(209,173,120,0.32),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(82,57,38,0.16),_transparent_24%),linear-gradient(135deg,_hsl(var(--sand))_0%,_hsl(var(--cream))_48%,_hsl(var(--linen))_100%)] px-6 py-10 text-foreground sm:px-8 lg:px-12">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(74,56,40,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(74,56,40,0.06)_1px,transparent_1px)] bg-[size:72px_72px] opacity-30" />
            <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
                <Card className="grid w-full max-w-5xl gap-0 overflow-hidden border-border/60 bg-card/85 shadow-[0_28px_90px_rgba(60,41,27,0.16)] backdrop-blur md:grid-cols-[1.2fr_0.8fr]">
                    <CardHeader className="justify-between border-b border-border/60 p-8 md:border-b-0 md:border-r md:p-12 lg:p-14">
                        <div className="space-y-5">
                            <Badge className="w-fit rounded-full bg-secondary px-4 py-1 text-[0.7rem] uppercase tracking-[0.28em] text-secondary-foreground shadow-none">
                                Personal Domain
                            </Badge>
                            <div className="space-y-4">
                                <h1 className="font-serif-display text-6xl leading-none tracking-[0.08em] text-foreground sm:text-7xl lg:text-8xl">
                                    FRK
                                </h1>
                                <p className="max-w-xl text-balance text-base leading-7 text-muted-foreground sm:text-lg">
                                    A quiet front door for now - built to feel
                                    editorial, simple, and intentional while the
                                    rest of the site takes shape.
                                </p>
                            </div>
                        </div>
                        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                            <Button
                                className="h-12 rounded-full px-6 text-base shadow-[0_16px_30px_rgba(34,24,16,0.24)]"
                                onClick={() => {
                                    window.location.href = `${authOrigin}/login`;
                                }}
                                type="button"
                            >
                                <Lock className="mr-2 size-4" />
                                Log in
                            </Button>
                            <p className="text-sm text-muted-foreground">
                                Sign in via `auth.frk.localhost`.
                            </p>
                        </div>
                    </CardHeader>
                    <CardContent className="flex flex-col justify-between gap-8 p-8 md:p-10 lg:p-12">
                        <div className="space-y-4">
                            <p className="text-sm uppercase tracking-[0.22em] text-muted-foreground">
                                Elsewhere
                            </p>
                            <div className="grid gap-3">
                                <SocialLink
                                    href={githubUrl}
                                    icon={<Github className="size-4" />}
                                    label="GitHub"
                                />
                                <SocialLink
                                    href={linkedinUrl}
                                    icon={<Linkedin className="size-4" />}
                                    label="LinkedIn"
                                />
                            </div>
                        </div>
                        <CardFooter className="rounded-3xl border border-border/70 bg-secondary/70 p-5 text-sm leading-6 text-muted-foreground">
                            More soon: a proper home page, deeper writing, and a
                            cleaner way into the rest of the FRK world.
                        </CardFooter>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
