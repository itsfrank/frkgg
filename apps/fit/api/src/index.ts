import { Elysia } from 'elysia';

type AppConfig = {
    standalone?: boolean;
    standaloneUsername?: string;
    standaloneEmail?: string;
};

function getConfig(config: AppConfig) {
    return {
        standalone: config.standalone ?? false,
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
            const username = request.headers.get('x-auth-user');
            const email = request.headers.get('x-auth-email');

            if (!username || !email) {
                return status(401, 'Unauthorized');
            }

            return {
                auth: {
                    username,
                    email,
                },
            };
        })
        .get('/api/me', ({ auth }) => ({
            username: auth.username,
            email: auth.email,
        }))
        .get('/api/hello', ({ auth }) => `hello ${auth.username}`);
}

const port = Number(process.env.PORT ?? 3003);

if (import.meta.main) {
    createApp({
        standalone: process.env.FIT_STANDALONE !== 'false',
        standaloneUsername: process.env.FIT_STANDALONE_USERNAME,
        standaloneEmail: process.env.FIT_STANDALONE_EMAIL,
    }).listen(port);

    console.log(`fit-api listening on http://localhost:${port}`);
}
