import notFoundPage from '../templates/404.html'
import createPostPage from '../templates/create-post.html'

import { parseCookie } from 'cookie'
import { getSession, routeError, 
        IncompleteSession, CompleteSession, 
        INCOMPLETE_KEY_PREFIX, COMPLETE_KEY_PREFIX, 
        logout, fetchUserId,
        SessionError } from './auth';
import { temporary_redirect } from './global';
import { parseFormData } from './blog';

const ALLOWLIST_KEY = "allowlist";

/*
Basic flow for authorizing accounts:
- if there is no cookie associated with "sid", then send directly to start of oauth signin/registration
- if there is, then grab the matching sid in the auth KV cache and go through the motion of refreshing

*/
function canPost(session: CompleteSession){

}



export async function handlePost(request: Request, env: Env): Promise<Response>{

    const sid = parseCookie(request.headers.get("Cookie") || "").sid;
    if (sid == undefined) {
        return temporary_redirect("/oauth/begin");
    }
    else if (sid.startsWith(INCOMPLETE_KEY_PREFIX)) {
        return temporary_redirect("/auth-in-progress.html");
    }
    else if (!(sid.startsWith(COMPLETE_KEY_PREFIX))){
        const logout_cookie = await logout(env, sid);
        return temporary_redirect("/oauth/begin", new Map([["Set-Cookie", logout_cookie]]));
    }

    let session: IncompleteSession | CompleteSession;
    try { session = await getSession(sid, env) }
    catch (err) { 
        if (err instanceof SessionError) {
        return routeError(err);
        }
        return routeError(new SessionError("Unexpected error checking session status")); 
    }
    if (session instanceof IncompleteSession){
        return temporary_redirect("/auth-in-progress");
    }
    const uid = await fetchUserId(session.access_token);
    if (uid == null){
        const logout_cookie = await logout(env, sid);
        return temporary_redirect("/oauth/begin", new Map([["Set-Cookie", logout_cookie]]));
    }

    const allowlist_json = await env.MINIFARMS_BLOG_AUTH.get(ALLOWLIST_KEY);
    const allowlist: string[] = JSON.parse(allowlist_json || "[]");
    if (!Array.isArray(allowlist) || !allowlist.every((s): s is string => typeof s === "string")) {
        console.log({level: "severe", data: "allowlist is malformed, fix IMMEDIATELY"});
        return temporary_redirect("/");
    }
    if (!allowlist.includes(uid) == undefined){
        return temporary_redirect("/");
    }
    // Everything past this point is safe, the user is verified

    if (request.url.startsWith("/post/create")){
        return new Response(createPostPage,
            {status: 200, statusText: "OK"}
        )
    }
    else if (request.url.startsWith("/post/submit")){

        const form = await request.formData();
        const blog = parseFormData(form);
        if (blog == null){
            return new Response(undefined, {
                status: 400,
                statusText: "Bad Request"
            })
        }

        const postJson = JSON.stringify({
            imgLink: blog.imgLink,
            category: blog.category,
            author: blog.author,
            title: blog.title,
            content: blog.content,
            date: blog.date.toISOString().split("T")[0],
        });

        await env.MINIFARMS_BLOG_KV.put(blog.key, postJson);

        return temporary_redirect("/blog/entry?key=" + blog.key);
    }
    return new Response(notFoundPage, {status: 404, statusText: "Not Found"});
}