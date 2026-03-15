import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import App from './App';

describe('site app', () => {
    test('renders login and social links', () => {
        render(<App />);

        expect(
            screen.getByRole('button', {
                name: /log in/i,
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', {
                name: /github/i,
            }),
        ).toHaveAttribute('href', 'https://github.com/itsfrank');
        expect(
            screen.getByRole('link', {
                name: /linkedin/i,
            }),
        ).toHaveAttribute('href', 'https://www.linkedin.com/in/frank-obrien/');
    });
});
