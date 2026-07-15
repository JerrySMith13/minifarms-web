/// <reference types="@cloudflare/workers-types" />

export interface Env {
  MINIFARMS_BLOG_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    /**
     * Replace `remote` with the host you wish to send requests to
     */
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/blog")){
      return new Response("Hai blog!!")
    }

    return new Response("hi")
  },
};
