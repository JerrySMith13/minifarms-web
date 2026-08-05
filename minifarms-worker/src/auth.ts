import { parseCookie, stringifySetCookie } from "cookie";
import { URLSearchParams } from "node:url";
import * as global from "./global"

export const 
    INCOMPLETE_KEY_PREFIX = "incom:",
    COMPLETE_KEY_PREFIX = "compl:",
    ALLOWLIST_KEY = "allowlist";

const OAUTH_CLIENT_ID = "70b6fd74b5113859e9b71ad72e892a4a"

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

class IncompleteSession{
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
        env.MINIFARMS_BLOG_AUTH.put(key, JSON.stringify(session));

        return [new URLSearchParams({
            response_type: 'code',
            client_id: OAUTH_CLIENT_ID,
            redirect_uri: `https://${global.HOST}/oauth/callback`,
            scope: 'workers-kv-storage.write',
            state: state,
            code_challenge: challenge,
            code_challenge_method: 'S256'
        }), key];
    }
    static async completeSession(env: Env, id: string, url_params: URLSearchParams): Promise<CompleteSession | null>{
        //Boilerplate session fetching + parsing
        if (!id.startsWith(INCOMPLETE_KEY_PREFIX)) return null;
        const json = await env.MINIFARMS_BLOG_AUTH.get(id);
        if (json == null) return null;
        const session = IncompleteSession.parse(json);
        if (session == null) return null;
        if (session.revoke_when <= Math.floor(+new Date() / 1000)){
            await env.MINIFARMS_BLOG_AUTH.delete(id);
            return null; //TODO: refactor so we get specific error handling in function
        }
        
        const code = url_params.get("code");
        if (code == null) return null;
        
        if (session.oauth_state != url_params.get("oauth_state")) return null;

        const response = await fetch('https://dash.cloudflare.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type:    'authorization_code',
                code,
                client_id:     OAUTH_CLIENT_ID,
                redirect_uri: `https://${global.HOST}/oauth/callback`,
                code_verifier: session.pkce_verifier, 
            }),
        });

        const tokens = await response.text();
        const complete_session = CompleteSession.parseTokenResponse(tokens);
        await env.MINIFARMS_BLOG_AUTH.delete(id);
        if (complete_session != null){
            let key: string;
            do {
            key = COMPLETE_KEY_PREFIX + base64urlEncode(crypto.getRandomValues(new Uint8Array(10)));
            }
            while ((await env.MINIFARMS_BLOG_AUTH.get(key)) != null);

            env.MINIFARMS_BLOG_AUTH.put(key, JSON.stringify(complete_session))
        }
        return complete_session;
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
    refresh_token: string;
    access_token: string;
    access_ttl: EpochTimeStamp; // This value is updated every time a new access token is requested

    constructor(refresh_token: string, access_token: string, access_ttl: number){
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

        if (typeof obj.refresh_token !== "string") return null;
        if (typeof obj.access_token !== "string") return null;
        if (typeof obj.access_ttl !== "number") return null;

        return new CompleteSession(obj.refresh_token, obj.access_token, obj.access_ttl);
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
        if (typeof obj.refresh_token !== "string") return null;
        if (typeof obj.expires_in !== "number") return null;

        const access_ttl = Math.floor(+new Date() / 1000) + obj.expires_in;
        return new CompleteSession(obj.refresh_token, obj.access_token, access_ttl);
    }
}


async function logout(env: Env, sid: string): Promise<string>{
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

function see_other(url: string, extra_headers?: Map<string, string>, body?: string): Response{
    const res = new Response(body, {
                status: 303,
                statusText: "See Other",
                headers: {
                    "Location": url,
                }
                });
    if (extra_headers != undefined){
        extra_headers.forEach((val: string, key: string) => {
            res.headers.append(key, val)
        });
    }
    return res;
}

async function handleAuth(request: Request, env: Env){
    const url = new URL(request.url);
    if (url.pathname.startsWith("/oauth/begin")){
        //first check for session already existing, and redirect to post if present
        const sid = parseCookie(request.headers.get("Cookie") || "").sid;
        if (!(sid==undefined)){
            if (sid.startsWith(INCOMPLETE_KEY_PREFIX)){
                //TODO: return a page that says "complete signin" here
            }
            else if (sid.startsWith(COMPLETE_KEY_PREFIX)){
                return see_other(`https://${global.HOST}/post`);
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
        
        return see_other(`https://dash.cloudflare.com/oauth2/authorize?${redir_params}`, new Map([["Set-Cookie", new_id]]));
    }

    else if (url.pathname.startsWith("/oauth/callback")){
        const sid = parseCookie(request.headers.get("Cookie") || "").sid;
        if (sid == undefined) return see_other(`https://${global.HOST}/oauth/begin`);
        if (sid.startsWith(COMPLETE_KEY_PREFIX)) return see_other(`https://${global.HOST}/post`);

        const current_session_json = await env.MINIFARMS_BLOG_AUTH.get(sid);
        if (current_session_json == null) return see_other(`https://${global.HOST}/oauth/begin`);

        const current_session = IncompleteSession.parse(current_session_json);
        if (current_session == null) {
            const new_cookie = await logout(env, sid);
            return see_other("insert url here", new Map([["Set-Cookie", new_cookie]])) //TODO: make an error page that says "error logging in, please try again"
        }

        if (current_session.oauth_state != url.searchParams.get("state")){
            const new_cookie = await logout(env, sid);
            return see_other("insert url here", new Map([["Set-Cookie", new_cookie]]))
        }

        const grant = url.searchParams.get("code");
        if (grant == null) return see_other("insert url here"); //TODO: return error page stating grant couldn't be found

        const response = await fetch("https://dash.cloudflare.com/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code: grant,
                client_id: OAUTH_CLIENT_ID,
                redirect_uri: `https://${global.HOST}/oauth/callback`,
                code_verifier: current_session.pkce_verifier,   // proves you initiated the flow — no secret needed
            }),
        });

        const tokens = await response.json();

        if (typeof tokens !== "object" || tokens === null) return see_other("insert url here"); //TODO: return error page stating token response couldn't be parsed
        const tokens_obj = tokens as Record<string, unknown>;
        if (typeof tokens_obj.access_token !== "string") return see_other("insert url here");
        if (typeof tokens_obj.refresh_token !== "string") return see_other("insert url here");
        if (typeof tokens_obj.expires_in !== "number") return see_other("insert url here");

        const access_ttl = Math.floor(+new Date() / 1000) + tokens_obj.expires_in;
        const complete_session = new CompleteSession(tokens_obj.refresh_token, tokens_obj.access_token, access_ttl);

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
        return see_other(`https://${global.HOST}/post`, new Map([["Set-Cookie", cookie]]));
        


    }

}

