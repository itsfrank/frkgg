import type * as React from 'react';

import { cn } from '@/lib/utils';

function Card({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn(
                'rounded-[calc(var(--radius)+0.25rem)] border bg-card text-card-foreground shadow-sm',
                className,
            )}
            {...props}
        />
    );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn('flex flex-col space-y-1.5 p-6', className)}
            {...props}
        />
    );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
    return <div className={cn('p-6 pt-0', className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn('flex items-center p-6 pt-0', className)}
            {...props}
        />
    );
}

export { Card, CardContent, CardFooter, CardHeader };
