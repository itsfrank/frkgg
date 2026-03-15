import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
    'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1 [&>svg]:size-3 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-[color,box-shadow] overflow-hidden',
    {
        variants: {
            variant: {
                default:
                    'border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
                secondary:
                    'border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

function Badge({
    className,
    variant,
    ...props
}: React.ComponentProps<'div'> & VariantProps<typeof badgeVariants>) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    );
}

export { Badge, badgeVariants };
