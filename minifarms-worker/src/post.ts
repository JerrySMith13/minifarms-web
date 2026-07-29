import notFoundPage from '../templates/404.html'

import { parseCookie } from 'cookie'
const ALLOWLIST_KEY = "allowlist"
/*
Basic flow for authorizing accounts:
- if there is no cookie associated with "sid", then send directly to start of oauth signin/registration
- if there is, then grab the matching sid in the auth KV cache and go through the motion of refreshing

*/
export async function handlePost(request: Request, env: Env): Promise<Response>{

    

    
}