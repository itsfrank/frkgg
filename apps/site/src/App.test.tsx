import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';

import App from './App';

describe('site app', () => {
    afterEach(() => {
        cleanup();
    });

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

    test('prefers returnTo query param for the login CTA', () => {
        window.history.replaceState(
            {},
            '',
            '/?returnTo=https://fit.frk.localhost/workouts/today?view=week',
        );

        render(<App />);

        expect(
            screen.getByRole('link', {
                name: /log in with github/i,
            }),
        ).toHaveAttribute(
            'href',
            'https://auth.frk.localhost/login/github?returnTo=https%3A%2F%2Ffit.frk.localhost%2Fworkouts%2Ftoday%3Fview%3Dweek',
        );
    });
});
