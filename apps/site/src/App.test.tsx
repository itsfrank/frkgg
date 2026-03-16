import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import App from './App';

describe('site app', () => {
    test('renders GitHub login CTA and social links', () => {
        window.history.replaceState({}, '', '/members?tab=notes#recent');

        render(<App />);

        expect(
            screen.getByRole('link', {
                name: /log in with github/i,
            }),
        ).toHaveAttribute(
            'href',
            'https://auth.frk.localhost/login/github?returnTo=%2Fmembers%3Ftab%3Dnotes%23recent',
        );
        expect(
            screen
                .getAllByRole('link')
                .find((link) => link.getAttribute('href') === 'https://github.com/itsfrank'),
        ).toHaveTextContent('GitHub');
        expect(
            screen.getByRole('link', {
                name: /linkedin/i,
            }),
        ).toHaveAttribute('href', 'https://www.linkedin.com/in/frank-obrien/');
        expect(
            screen.getByText(/sign in with github via/i),
        ).toBeInTheDocument();
    });
});
