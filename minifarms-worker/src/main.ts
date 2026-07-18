import { blogHandle } from "./blog";

export default {

    async fetch(request: Request, env: Env){
        const url = new URL(request.url);
        let path = url.pathname
    
        if (path.startsWith("/blog")){
            return await blogHandle(request, env)
        }
        

    }
}