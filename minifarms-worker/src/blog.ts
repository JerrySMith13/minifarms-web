import blogListText from '../templates/blog.html'
import blogCard from '../templates/partials/blog-card.html'

import * as cheerio from 'cheerio'

interface BlogPost{
    key: string, //The key is just the key from our cloudflare KV cache. this will be appended to a url like /blog/entry?q=KEY to get our key
    imgLink: string,
    category: string,
    author: string,
    content: string
}

function createCard(template: cheerio.CheerioAPI, )

export async function blogHandle(request: Request, env: Env){
    const url = new URL(request.url)
    if (!(url.pathname.startsWith("/blog"))){
        //return 404 here
    }
    // returns rendered page of blog listings
    if (url.pathname.startsWith("/blog/list")){
    
        const listData = await env.MINIFARMS_BLOG_KV.list();
        let baseTemplate = cheerio.load(blogListText);
        let cardTemplate = cheerio.load(blogCard);
        baseTemplate(".blog-post-card").remove(); // Remove the card template that's already in list


        

        
        
        
    }
    else if (url.pathname.startsWith("/blog/entry")){
        // return a specific rendered blog entry
    }
}