import notFoundPage from "../templates/404.html";
import { handleBlog } from "./blog";
import { handlePost } from "./post"

export default {

    async fetch(request: Request, env: Env){
        const url = new URL(request.url);
        let path = url.pathname

        if (path.startsWith("/blog")){
            return await handleBlog(request, env)
        }
        else if (path.startsWith("/post")){
            return await handlePost(request, env)
        }

        return new Response(notFoundPage, {
            status: 404,
            headers: { "content-type": "text/html;charset=UTF-8" }
        })
    }
}