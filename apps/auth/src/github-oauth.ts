import { err, ok, type Result } from '@frkgg/shared';

import { githubAllowedUsers } from './github-allowed-users';

export type FetchLike = (
    input: string | URL | Request,
    init?: RequestInit,
) => Promise<Response>;

type GithubOAuthConfig = {
    authOrigin: string;
    githubClientId: string;
    githubClientSecret: string;
    fetchImpl?: FetchLike;
};

type GithubProfile = {
    id: number;
    login: string;
    email?: string | null;
};

const githubAllowedUserSet = new Set(
    githubAllowedUsers.map((user) => user.trim().toLowerCase()),
);

function callbackUrl(authOrigin: string) {
    return new URL('/oauth/github/callback', authOrigin).toString();
}

export function createGithubAuthorizeUrl(
    authOrigin: string,
    githubClientId: string,
    state: string,
) {
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', githubClientId);
    url.searchParams.set('redirect_uri', callbackUrl(authOrigin));
    url.searchParams.set('scope', 'read:user user:email');
    url.searchParams.set('state', state);
    return url.toString();
}

export function createGithubLoginResponse(
    authOrigin: string,
    githubClientId: string,
    state: string,
) {
    return new Response(null, {
        status: 302,
        headers: {
            Location: createGithubAuthorizeUrl(
                authOrigin,
                githubClientId,
                state,
            ),
        },
    });
}

export function isGithubUserAllowed(login: string) {
    return githubAllowedUserSet.has(login.trim().toLowerCase());
}

async function fetchGithubAccessToken(
    config: GithubOAuthConfig,
    code: string,
): Promise<Result<string, { code: number; message: string }>> {
    const fetchImpl = config.fetchImpl ?? fetch;
    const response = await fetchImpl(
        'https://github.com/login/oauth/access_token',
        {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: config.githubClientId,
                client_secret: config.githubClientSecret,
                code,
                redirect_uri: callbackUrl(config.authOrigin),
            }).toString(),
        },
    );
    if (!response.ok) {
        return err({ code: 502, message: 'GitHub token exchange failed' });
    }

    const body = (await response.json()) as
        | {
              access_token?: string;
              error?: string;
          }
        | undefined;

    if (!body?.access_token || body.error) {
        return err({ code: 502, message: 'GitHub token exchange failed' });
    }

    return ok(body.access_token);
}

async function fetchGithubProfile(
    fetchImpl: FetchLike,
    accessToken: string,
): Promise<Result<GithubProfile, { code: number; message: string }>> {
    const response = await fetchImpl('https://api.github.com/user', {
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'frkgg-auth',
        },
    });
    if (!response.ok) {
        return err({ code: 502, message: 'GitHub user lookup failed' });
    }

    const body = (await response.json()) as
        | {
              id?: number;
              login?: string;
              email?: string | null;
          }
        | undefined;

    if (!body?.login || !body.id) {
        return err({ code: 502, message: 'GitHub user lookup failed' });
    }

    return ok({
        id: body.id,
        login: body.login,
        email: body.email,
    });
}

async function fetchGithubEmail(
    fetchImpl: FetchLike,
    accessToken: string,
): Promise<Result<string, { code: number; message: string }>> {
    const response = await fetchImpl('https://api.github.com/user/emails', {
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'frkgg-auth',
        },
    });
    if (!response.ok) {
        return err({ code: 502, message: 'GitHub email lookup failed' });
    }

    const body = (await response.json()) as
        | Array<{
              email?: string;
              primary?: boolean;
              verified?: boolean;
          }>
        | undefined;

    const primaryEmail = body?.find(
        (entry) => entry.primary && entry.verified && entry.email,
    )?.email;

    if (!primaryEmail) {
        return err({ code: 502, message: 'GitHub email lookup failed' });
    }

    return ok(primaryEmail);
}

export async function authenticateGithubUser(
    config: GithubOAuthConfig,
    code: string,
): Promise<
    Result<
        {
            login: string;
            email: string;
        },
        { code: number; message: string }
    >
> {
    const fetchImpl = config.fetchImpl ?? fetch;

    const tokenRes = await fetchGithubAccessToken(config, code);
    if (!tokenRes.ok) return tokenRes;

    const profileRes = await fetchGithubProfile(fetchImpl, tokenRes.value);
    if (!profileRes.ok) return profileRes;

    const login = profileRes.value.login.toLowerCase();
    if (!isGithubUserAllowed(login)) {
        return err({ code: 403, message: 'Forbidden: GitHub user is not allowed' });
    }

    const email =
        profileRes.value.email ??
        (await (async () => {
            const emailRes = await fetchGithubEmail(fetchImpl, tokenRes.value);
            if (emailRes.ok) return emailRes.value;
            return `${login}@users.noreply.github.com`;
        })());

    return ok({
        login: profileRes.value.login,
        email,
    });
}
