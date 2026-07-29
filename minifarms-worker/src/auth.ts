import { parseCookie } from "cookie";
import { URLSearchParams } from "node:url";
const SESSION_KEY_PREFIX = "session:"
const OAUTH_CLIENT_ID = "70b6fd74b5113859e9b71ad72e892a4a"
// session tracking 
// json object with following members:
// status: string / a simple string describing the status of auth with values:
    //"incomplete" - means that "/oauth/begin" was called, but is unfinished
        // this will accompany two members: pkce_verifier and oauth_state
    //"complete" - means the full flow was activated, contains access token, refresh token, and expiry (scope unneeded as of now)
    //"revoked" - oauth flow needs to be completed again

interface Session{
    status: string,

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

async function getSession(request: Request, env: Env): Promise<Session | null>{
    const sid = parseCookie(request.headers.get("Cookie") || "").sid;
    if (sid === undefined) return null;

    const session_str = await env.MINIFARMS_BLOG_AUTH.get(sid);
    if (session_str == null) return null;

    const session
    // todo: add log for catching invalid json
}

async function handleAuth(request: Request, env: Env){
    const url = new URL(request.url);
    if (url.pathname.startsWith("/oauth/begin")){
        //first check for session already existing, and redirect to post if present
        const sid = parseCookie(request.headers.get("Cookie") || "").sid;
        if (!(sid==undefined)){
            // TODO: validify sid to determine either redirect or continue oauth flow
            return new Response(null, {
                status: 303,
                statusText: "See Other",
                headers: {
                    "Location": `https://${url.hostname}/post`
                }
            });
        }

        const { verifier, challenge } = await generatePKCE();
        const state = base64urlEncode(crypto.getRandomValues(new Uint8Array(16)));

        const url_params = new URLSearchParams({
            response_type: 'code',
            client_id: OAUTH_CLIENT_ID,
            redirect_uri: `https://${url.hostname}/oauth/callback`,
            scope: 'workers-kv-storage.write',
            state,
            code_challenge: challenge,
            code_challenge_method: 'S256'

        });

        return new Response(null, {
            status: 303,
            statusText: "See Other",
            headers: {"Location": `https://dash.cloudflare.com/oauth2/authorize?${url_params}`}
        });


    }
    else if (url.pathname.startsWith("/oauth/callback")){
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");

        
    }
}

