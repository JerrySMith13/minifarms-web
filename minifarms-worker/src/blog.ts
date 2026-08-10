import blogListText from '../templates/blog.html'
import blogCard from '../templates/partials/blog-card.html'
import blogPost from '../templates/blog-post.html'
import notFoundPage from '../templates/404.html'
import blogPostSchema from '../schemas/blogPost.json'

import * as cheerio from 'cheerio'

export interface BlogPost{
    key: string, //The key is just the key from our cloudflare KV cache. this will be appended to a url like /blog/entry?q=KEY to get our key
    imgLink: string,
    category: string,
    author: string,
    title: string,
    content: string,
    date: Date,
}
export function postFromObj(obj: any, key: string): BlogPost | null{
    if (!obj || typeof obj !== 'object'){
        return null;
        
    }

    for (const field of blogPostSchema.required){
        if (obj[field] === undefined || obj[field] === null){
            return null;
        }
    }

    const { imgLink, category, author, title, content, date } = obj;

    if (
        typeof imgLink !== 'string' ||
        typeof category !== 'string' ||
        typeof author !== 'string' ||
        typeof content !== 'string' ||
        typeof date !== 'string'
    ){
        return null;
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())){
        return null;
    }

	return { key, imgLink, category, author, title: title || "", content, date: parsedDate };
}

export function parseFormData(formData: FormData): BlogPost | null{
	const imgLink = formData.get("imgLink");
	const category = formData.get("category");
	const author = formData.get("author");
	const content = formData.get("content");
	const date = formData.get("date");
	const title = formData.get("title");

	if (!imgLink || !category || !author || !content || !date){
		return null;
	}

	const parsedDate = new Date(date.toString());
	if (isNaN(parsedDate.getTime())){
		return null;
	}

	const key = crypto.randomUUID();

	return {
		key,
		imgLink: imgLink.toString(),
		category: category.toString(),
		author: author.toString(),
		title: title ? title.toString() : "",
		content: content.toString(),
		date: parsedDate,
	};
}

// This function will consume the template 
function createCard(card: string, post: BlogPost): string{
    let template = cheerio.load(card);

    template("[data-dynamic=link]").attr("href", "/blog/entry?key=" + post.key);
    template("[data-dynamic=image-link]").attr("src", post.imgLink);
    template("[data-dynamic=category]").text(post.category);
    template("[data-dynamic=author]").text(post.author);
    template("[data-dynamic=title]").text(post.title);
    template("[data-dynamic=content]").text(post.content.substring(0, 200));
    template("[data-dynamic=date]").text(post.date.toDateString());
    return template.html();
}

function createPost(blog: string, post: BlogPost){
    let template = cheerio.load(blog);

    template("[data-dynamic=link]").attr("href", "/blog/entry?key=" + post.key);
    template("[data-dynamic=image-link]").attr("src", post.imgLink);
    template("[data-dynamic=category]").text(post.category);
    template("[data-dynamic=author]").text(post.author);
    template("[data-dynamic=title]").text(post.title);
    template("[data-dynamic=content]").text(post.content);
    template("[data-dynamic=date]").text(post.date.toDateString());
    return template.html();
}

export async function handleBlog(request: Request, env: Env){
    const url = new URL(request.url)
    
    // returns rendered page of blog listings
    if (url.pathname.startsWith("/blog/list")){
    
        const listDataPromise = env.MINIFARMS_BLOG_KV.list();

        let baseTemplate = cheerio.load(blogListText);
        baseTemplate(".blog-post-card").remove(); // Remove the card template that's already in list

        for (let key of (await listDataPromise).keys){
            let obj = await env.MINIFARMS_BLOG_KV.get(key.name, "json");
            if (obj == null) continue;

            const post = postFromObj(obj, key.name)
            if (post == null) continue;
            const card = createCard(blogCard, post)
            baseTemplate(".blog-list").append(card);
        }
        return new Response(baseTemplate.html(), {
            headers: { "content-type": "text/html;charset=UTF-8" }
        })
        
    }
    else if (url.pathname.startsWith("/blog/entry")){
        const key = url.searchParams.get("key");
        if (key == null){
            return new Response(notFoundPage, {
                status: 404,
                headers: { "content-type": "text/html;charset=UTF-8" }
            });
        }

        const blogEntry = await env.MINIFARMS_BLOG_KV.get(key, "json");
        if (blogEntry == null){
            return new Response(notFoundPage, {
                status: 404,
                headers: { "content-type": "text/html;charset=UTF-8" }
            });
        }

        const blogObj = postFromObj(blogEntry, key);
        if (blogObj == null){
            return new Response(notFoundPage, {
                status: 404,
                headers: { "content-type": "text/html;charset=UTF-8" }
            });
        }

        const blogContent = createPost(blogPost, blogObj);
        return new Response(blogContent, {
            headers: { "content-type": "text/html;charset=UTF-8" }
        });
        
        
    }
    else {
        return new Response(notFoundPage, {
            status: 404,
            headers: { "content-type": "text/html;charset=UTF-8" }
        })
    }
}
