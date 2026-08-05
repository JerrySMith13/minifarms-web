import notFoundPage from '../templates/404.html'
import { CompleteSession, INCOMPLETE_KEY_PREFIX, COMPLETE_KEY_PREFIX } from './auth';

import { parseCookie } from 'cookie'


/*
Basic flow for authorizing accounts:
- if there is no cookie associated with "sid", then send directly to start of oauth signin/registration
- if there is, then grab the matching sid in the auth KV cache and go through the motion of refreshing

*/

async function getSession(request: Request, env: Env){
    const cookie = parseCookie(request.headers.get("Cookie") || "");
    const sid = cookie.sid;
    if (sid == undefined) return new Response(null, {
        status: 308,
        statusText: "Permanent Redirect",
        headers: {"Location": `https://${HOST}/oauth/callback`},
    });

    else if (sid.startsWith(INCOMPLETE_KEY_PREFIX)){ //TODO: see ln 210 todo in auth
        
    }
    else if (!(sid.startsWith(COMPLETE_KEY_PREFIX))){ //logout

    }
    const session_json = env.MINIFARMS_BLOG_AUTH.get()

}

export async function handlePost(request: Request, env: Env): Promise<Response>{

    

    
}