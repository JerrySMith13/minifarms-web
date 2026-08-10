import { parseCookie, parseSetCookie, stringifySetCookie } from "cookie";
import { URLSearchParams } from "node:url";
import * as global from "./global"
import { temporary_redirect } from "./global";

export const 
    INCOMPLETE_KEY_PREFIX = "incom:",
    COMPLETE_KEY_PREFIX = "compl:";

const OAUTH_CLIENT_ID = "70b6fd74b5113859e9b71ad72e892a4a"

export class SessionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SessionError";
    }
}

export class SessionNotFoundError extends SessionError {
    constructor(key: string) {
        super(`No session found for key: ${key}`);
        this.name = "SessionNotFoundError";
    }
}

export class SessionMalformedError extends SessionError {
    constructor(key: string) {
        super(`Session data is malformed for key: ${key}`);
        this.name = "SessionMalformedError";
    }
}

export class SessionExpiredError extends SessionError {
    constructor(key: string) {
        super(`Session has expired for key: ${key}`);
        this.name = "SessionExpiredError";
    }
}

export class UnknownSessionTypeError extends SessionError {
    constructor(key: string) {
        super(`Unrecognized session type for key: ${key}`);
        this.name = "UnknownSessionTypeError";
    }
}

export class AuthCodeMissingError extends Error {
    constructor() {
        super("OAuth authorization code not received from provider");
        this.name = "AuthCodeMissingError";
    }
}

export class TokenExchangeError extends Error {
    constructor(reason: string) {
        super(`Token exchange failed: ${reason}`);
        this.name = "TokenExchangeError";
    }
}

function base64urlEncode(buffer: Uint8Array) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generatePKCE() {
  // code_verifier: random 43-128 char string
  const verifier = base64urlEncode(crypto.getRandomValues(new Uint8Array(32)));

  // code_challenge: SHA-256 hash of verifier, base64url-encoded (S256 method)
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  const challenge = base64urlEncode(new Uint8Array(digest));

  return { verifier, challenge };
}

export class IncompleteSession{
    pkce_verifier: string;
    oauth_state: string;
    revoke_when: EpochTimeStamp;

    constructor(pkce_verifier: string, oauth_state: string, revoke_when: number){
        this.pkce_verifier = pkce_verifier;
        this.oauth_state = oauth_state;
        this.revoke_when = revoke_when;
    }

    static async initiateSession(env: Env): Promise<[URLSearchParams, string]>{
        let key: string;
        do {
            key = INCOMPLETE_KEY_PREFIX + base64urlEncode(crypto.getRandomValues(new Uint8Array(10)));
        }
        while ((await env.MINIFARMS_BLOG_AUTH.get(key)) != null);
        const { verifier, challenge } = await generatePKCE();
        const state = base64urlEncode(crypto.getRandomValues(new Uint8Array(16)));
        const revoke_when = Math.floor(+new Date() / 1000) + 3600; // revokes the pending session if link becomes stale
        const session = new IncompleteSession(verifier, state, revoke_when);
        try {
            await env.MINIFARMS_BLOG_AUTH.put(key, JSON.stringify(session));
        }   catch(e){
            console.log({level: "high", error: e});
        }

        return [new URLSearchParams({
            response_type: 'code',
            client_id: OAUTH_CLIENT_ID,
            redirect_uri: `https://${global.HOST}/oauth/callback`,
            scope: 'user-details.read',
            state: state,
            code_challenge: challenge,
            code_challenge_method: 'S256'
        }), key];
    }

    static parse(json: string): IncompleteSession | null {
        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch {
            return null;
        }
        if (typeof parsed !== "object" || parsed === null) return null;
        const obj = parsed as Record<string, unknown>;

        if (typeof obj.pkce_verifier !== "string") return null;
        if (typeof obj.oauth_state !== "string") return null;
        if (typeof obj.revoke_when !== "number") return null;

        return new IncompleteSession(obj.pkce_verifier, obj.oauth_state, obj.revoke_when);
    }

}

export class CompleteSession {
    refresh_token: string | undefined;
    access_token: string;
    access_ttl: EpochTimeStamp; // This value is updated every time a new access token is requested

    constructor(refresh_token: string | undefined, access_token: string, access_ttl: number){
        this.refresh_token = refresh_token;
        this.access_token = access_token;
        this.access_ttl = access_ttl;
    }

    static parse(json: string): CompleteSession | null {
        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch {
            return null;
        }
        if (typeof parsed !== "object" || parsed === null) return null;
        const obj = parsed as Record<string, unknown>;

        if (typeof obj.access_token !== "string") return null;
        if (typeof obj.access_ttl !== "number") return null;

        const refresh_token = typeof obj.refresh_token === "string" ? obj.refresh_token : undefined;
        return new CompleteSession(refresh_token, obj.access_token, obj.access_ttl);
    }

    static parseTokenResponse(json: string): CompleteSession | null {
        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch {
            return null;
        }
        if (typeof parsed !== "object" || parsed === null) return null;
        const obj = parsed as Record<string, unknown>;

        if (typeof obj.access_token !== "string") return null;
        if (typeof obj.expires_in !== "number") return null;

        const refresh_token = typeof obj.refresh_token === "string" ? obj.refresh_token : undefined;
        const access_ttl = Math.floor(+new Date() / 1000) + obj.expires_in;
        return new CompleteSession(refresh_token, obj.access_token, access_ttl);
    }
}

export async function getSession(key: string, env: Env): Promise<IncompleteSession | CompleteSession> {
    let isComplete: boolean;
    if (key.startsWith(COMPLETE_KEY_PREFIX)) {
        isComplete = true;
    } else if (key.startsWith(INCOMPLETE_KEY_PREFIX)) {
        isComplete = false;
    } else {
        throw new UnknownSessionTypeError(key);
    }

    const json = await env.MINIFARMS_BLOG_AUTH.get(key);
    if (json == null) {
        throw new SessionNotFoundError(key);
    }

    const now = Math.floor(+new Date() / 1000);

    if (isComplete) {
        const session = CompleteSession.parse(json);
        if (session == null) {
            throw new SessionMalformedError(key);
        }
        if (session.access_ttl <= now) {
            throw new SessionExpiredError(key);
        }
        return session;
    }

    const session = IncompleteSession.parse(json);
    if (session == null) {
        throw new SessionMalformedError(key);
    }
    if (session.revoke_when <= now) {
        throw new SessionExpiredError(key);
    }
    return session;
}

export async function fetchUserId(access_token: string): Promise<string | null> {
    // First, get the user ID from the OAuth userinfo endpoint
    let userinfo_response: Response;
    try {
        userinfo_response = await fetch("https://dash.cloudflare.com/oauth2/userinfo", {
            headers: { "Authorization": `Bearer ${access_token}` },
        });
    } catch { return null; }
    if (!userinfo_response.ok) return null;

    let userinfo: unknown;
    try {
        userinfo = await userinfo_response.json();
    } catch { return null; }
    if (typeof userinfo !== "object" || userinfo === null) return null;
    const userinfo_obj = userinfo as Record<string, unknown>;
    if (typeof userinfo_obj.sub !== "string") return null;
    return userinfo_obj.sub;

}

export async function logout(env: Env, sid: string): Promise<string>{
    await env.MINIFARMS_BLOG_AUTH.delete(sid);
    return stringifySetCookie({
        name: "sid",
        value: "",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        expires: new Date(0),
    });
}

export function routeError(err: Error, extra_headers?: Map<string, string>): Response {
    let target: string;
    if (err instanceof AuthCodeMissingError) {
        target = "/auth-code-missing.html";
    } else if (err instanceof TokenExchangeError) {
        target = "/auth-token-error.html";
    } else if (err instanceof SessionExpiredError){
        target = "/oauth/begin";
    } 
    else {
        target = "/auth-error.html";
    }

    const logout_cookie = stringifySetCookie({
        name: "sid",
        value: "",
        httpOnly: true,
        secure: true,
        sameSite: "lax"
    })
    extra_headers?.set("Set-Cookie", logout_cookie);
    return temporary_redirect(target, extra_headers);
}

export async function handleAuth(request: Request, env: Env){
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname.startsWith("/oauth/status")){
        const sid = parseCookie(request.headers.get("Cookie") || "").sid;

        if (sid == undefined) {
            return new Response("Not logged in.", { headers: { "Content-Type": "text/plain" } });
        }

        if (sid.startsWith(INCOMPLETE_KEY_PREFIX)) {
            return new Response("Login in progress (OAuth flow started but not completed).", { headers: { "Content-Type": "text/plain" } });
        }

        if (sid.startsWith(COMPLETE_KEY_PREFIX)) {
            try {
                const session = await getSession(sid, env) as CompleteSession;
                const now = Math.floor(+new Date() / 1000);
                const ttl_remaining = session.access_ttl - now;
                const token_status = `Access token expires in ${ttl_remaining} seconds.`;

                const user = await fetchUserId(session.access_token);
                const body = `User ID: \n${user}\n${token_status}\n`;
                return new Response(body, { headers: { "Content-Type": "text/plain" } });
            } catch (err) {
                if (err instanceof SessionError) {
                    return routeError(err);
                }
                return routeError(new SessionError("Unexpected error checking session status"));
            }
        }

        return new Response("Unknown session state.", { headers: { "Content-Type": "text/plain" } });
    }

    else if (url.pathname.startsWith("/oauth/begin")){
        //first check for session already existing, and redirect to post if present
        const sid = parseCookie(request.headers.get("Cookie") || "").sid;
        if (!(sid==undefined)){
            if (sid.startsWith(INCOMPLETE_KEY_PREFIX)){
                return temporary_redirect("/auth-in-progress.html");
            }
            else if (sid.startsWith(COMPLETE_KEY_PREFIX)){
                return temporary_redirect(`https://${global.HOST}/post`);
            }
        }

        const [redir_params, id] = await IncompleteSession.initiateSession(env);
        const new_id = stringifySetCookie({
            name: "sid",
            value: id,
            httpOnly: true,
            secure: true,
            sameSite: "lax",
        })
        
        return temporary_redirect(`https://dash.cloudflare.com/oauth2/authorize?${redir_params}`, new Map([["Set-Cookie", new_id]]));
    }

    else if (url.pathname.startsWith("/oauth/callback")){
        const sid = parseCookie(request.headers.get("Cookie") || "").sid;
        if (sid == undefined) return temporary_redirect(`https://${global.HOST}/oauth/begin`);
        if (sid.startsWith(COMPLETE_KEY_PREFIX)) return temporary_redirect(`https://${global.HOST}/post`);

        let current_session: IncompleteSession;
        try {
            const session = await getSession(sid, env);
            if (!(session instanceof IncompleteSession)) {
                throw new UnknownSessionTypeError(sid);
            }
            current_session = session;
        } catch (err) {
            const cookie = await logout(env, sid);
            if (err instanceof SessionError) {
                return routeError(err, new Map([["Set-Cookie", cookie]]));
            }
            return routeError(new SessionError("Unexpected error during login"), new Map([["Set-Cookie", cookie]]));
        }

        if (current_session.oauth_state != url.searchParams.get("state")){
            const new_cookie = await logout(env, sid);
            return routeError(new SessionError("OAuth state mismatch"), new Map([["Set-Cookie", new_cookie]]));
        }

        const grant = url.searchParams.get("code");
        if (grant == null) return routeError(new AuthCodeMissingError());

        let token_response: Response;
        try {
            token_response = await fetch("https://dash.cloudflare.com/oauth2/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    code: grant,
                    client_id: OAUTH_CLIENT_ID,
                    redirect_uri: `https://${global.HOST}/oauth/callback`,
                    code_verifier: current_session.pkce_verifier,
                }),
            });
        } catch {
            return routeError(new TokenExchangeError("network error contacting token endpoint"));
        }

        if (!token_response.ok) return routeError(new TokenExchangeError(`token endpoint returned HTTP ${token_response.status}`));

        let token_text: string;
        try {
            token_text = await token_response.text();
        } catch {
            return routeError(new TokenExchangeError("failed to read token response body"));
        }

        const complete_session = CompleteSession.parseTokenResponse(token_text);
        if (complete_session == null) return routeError(new TokenExchangeError("invalid token response format"));

        await env.MINIFARMS_BLOG_AUTH.delete(sid);
        let key: string;
        do {
            key = COMPLETE_KEY_PREFIX + base64urlEncode(crypto.getRandomValues(new Uint8Array(10)));
        }
        while ((await env.MINIFARMS_BLOG_AUTH.get(key)) != null);

        await env.MINIFARMS_BLOG_AUTH.put(key, JSON.stringify(complete_session));

        const cookie = stringifySetCookie({
            name: "sid",
            value: key,
            httpOnly: true,
            secure: true,
            sameSite: "lax"
        });
        return temporary_redirect(`https://${global.HOST}/post`, new Map([["Set-Cookie", cookie]]));
        


    }

}
