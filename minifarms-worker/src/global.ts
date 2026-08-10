export const HOST = "minifarms-worker.jeremy-ws-2008.workers.dev"
export function temporary_redirect(url: string, extra_headers?: Map<string, string>, body?: string): Response{
    const res = new Response(body, {
                status: 302,
                statusText: "Found",
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