import { Elysia } from 'elysia';

type AppConfig = {
    standalone?: boolean;
    standaloneUserId?: number | string;
    standaloneUsername?: string;
    standaloneEmail?: string;
};

function parseUserId(value: string | null) {
    if (value === null) {
        return null;
    }

    const userId = Number(value);
    if (!Number.isInteger(userId) || userId < 1) {
        return null;
    }

    return userId;
}

function getConfig(config: AppConfig) {
    const standaloneUserId = String(config.standaloneUserId ?? 1);

    if (parseUserId(standaloneUserId) === null) {
        throw new Error(
            'FIT_STANDALONE_USER_ID must be a positive integer when standalone mode is enabled',
        );
    }

    return {
        standalone: config.standalone ?? false,
        standaloneUserId,
        standaloneUsername: config.standaloneUsername ?? 'dev-user',
        standaloneEmail: config.standaloneEmail ?? 'dev-user@example.com',
    };
}

export function createApp(config: AppConfig = {}) {
    const resolvedConfig = getConfig(config);

    return new Elysia()
        .derive(({ request }) => {
            if (!resolvedConfig.standalone) {
                return;
            }

            if (!request.headers.has('x-auth-id')) {
                request.headers.set(
                    'x-auth-id',
                    resolvedConfig.standaloneUserId,
                );
            }
            if (!request.headers.has('x-auth-user')) {
                request.headers.set(
                    'x-auth-user',
                    resolvedConfig.standaloneUsername,
                );
            }
            if (!request.headers.has('x-auth-email')) {
                request.headers.set(
                    'x-auth-email',
                    resolvedConfig.standaloneEmail,
                );
            }
        })
        .derive(({ request, status }) => {
            const userId = parseUserId(request.headers.get('x-auth-id'));
            const username = request.headers.get('x-auth-user');
            const email = request.headers.get('x-auth-email');

            if (userId === null || !username || !email) {
                return status(401, 'Unauthorized');
            }

            return {
                auth: {
                    id: userId,
                    username,
                    email,
                },
            };
        })
        .get('/api/me', ({ auth }) => ({
            id: auth.id,
            username: auth.username,
            email: auth.email,
        }))
        .get('/api/hello', ({ auth }) => `hello ${auth.username}`);
}

const port = Number(process.env.PORT ?? 3003);

if (import.meta.main) {
    createApp({
        standalone: process.env.FIT_STANDALONE !== 'false',
        standaloneUserId: process.env.FIT_STANDALONE_USER_ID,
        standaloneUsername: process.env.FIT_STANDALONE_USERNAME,
        standaloneEmail: process.env.FIT_STANDALONE_EMAIL,
    }).listen(port);

    console.log(`fit-api listening on http://localhost:${port}`);
}
