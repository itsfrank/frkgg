import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import App from './App';

describe('App', () => {
    it('renders the fit welcome copy', async () => {
        globalThis.fetch = vi
            .fn()
            .mockImplementation((input: string | URL | Request) => {
                const url =
                    typeof input === 'string'
                        ? input
                        : input instanceof URL
                          ? input.toString()
                          : input.url;

                if (url.endsWith('/api/me')) {
                    return Promise.resolve({
                        ok: true,
                        json: async () => ({
                            username: 'itsfrank',
                            email: 'me@frk.gg',
                        }),
                    } as Response);
                }

                return Promise.resolve({
                    ok: true,
                    text: async () => 'hello itsfrank',
                } as Response);
            });

        render(<App />);

        expect(
            await screen.findByText('Welcome to fit, itsfrank'),
        ).toBeInTheDocument();
        expect(await screen.findByText('hello itsfrank')).toBeInTheDocument();
        expect(screen.queryByLabelText(/username/i)).not.toBeInTheDocument();
    });

    it('shows an error state when identity cannot be loaded', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
        } as Response);

        render(<App />);

        expect(
            await screen.findByText('Unable to load authenticated user'),
        ).toBeInTheDocument();
        expect(screen.getByText('hello unavailable')).toBeInTheDocument();
    });
});
