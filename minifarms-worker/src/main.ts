import notFoundPage from "../templates/404.html";
import { handleBlog } from "./blog";
import { handlePost } from "./post"
import { handleAuth } from "./auth";

export default {

    async fetch(request: Request, env: Env){
        const url = new URL(request.url);

        if (url.pathname.startsWith("/blog")){
            return await handleBlog(request, env);
        }
        else if (url.pathname.startsWith("/post")){
            return await handlePost(request, env);
        }
        else if (url.pathname.startsWith("/oauth") || url.pathname.startsWith("/auth")){
            return await handleAuth(request, env);
        }

        return new Response(notFoundPage, {
            status: 404,
            headers: { "content-type": "text/html;charset=UTF-8" }
        })
    }
}