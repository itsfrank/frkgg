import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-4 shrink-0 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
    {
        variants: {
            variant: {
                default:
                    'bg-primary text-primary-foreground shadow-xs hover:bg-primary/92',
                outline:
                    'border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground',
            },
            size: {
                default: 'h-10 px-4 py-2',
                lg: 'h-11 rounded-md px-8',
                icon: 'size-9',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

function Button({
    className,
    variant,
    size,
    ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
    return (
        <button
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
}

export { Button, buttonVariants };
