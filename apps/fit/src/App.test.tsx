import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import App from './App';

describe('App', () => {
    it('renders the fit welcome copy', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => 'hello friend',
        } as Response);

        render(<App />);

        expect(screen.getByText('Welcome to fit, friend')).toBeInTheDocument();
        expect(await screen.findByText('hello friend')).toBeInTheDocument();
    });
});
