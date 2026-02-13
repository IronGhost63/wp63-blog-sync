/**
 * Welcome to Cloudflare Workers!
 *
 * This is a template for a Scheduled Worker: a Worker that can run on a
 * configurable interval:
 * https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { env } from "cloudflare:workers";

const sendToQueue = async () => {
  const url = 'https://cms.jirayu.in.th/wp-json/wp/v2/posts?_fields=id&per_page=100';
  const response = await fetch(url);

  if ( !response.ok ) {
    console.log('Failed to retrieve post list');

    return;
  }

  const postList = await response.json();
  const messages = postList.map( (post) => {
    return {
      body: post
    }
  });

  await env.SYNC_QUEUE.sendBatch( messages );

  console.log(`data sent to queue: ${JSON.stringify(postList)}`);
}

const insertPost = async (post) => {
  const statement = env.DB.prepare(`
      INSERT INTO web_posts ('id', 'title', 'content', 'slug', 'datetime', 'modified', 'type', 'categories', 'tags', 'excerpt', 'featured_image')
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11);
    `)
      .bind(1, post.id)
      .bind(2, post.title)
      .bind(3, post.content)
      .bind(4, post.slug)
      .bind(5, post.datetime)
      .bind(6, post.modified)
      .bind(7, post.type)
      .bind(8, post.categories)
      .bind(9, post.tags)
      .bind(10, post.excerpt)
      .bind(11, post.featured_image);

  try {
    const result = await statement.run();

    console.log(`post ${post.id} is inserted`);
  } catch(e) {
    console.log(`unable to insert: ${JSON.stringify(e)}`)
  }
}

const updatePost = async (post) => {
  const statement = env.db.prepare(`
      UPDATE web_posts
      SET
        title = ?2,
        content = ?3,
        slug = ?4,
        datetime = ?5,
        modified = ?6,
        type = ?7,
        categories = ?8,
        tags = ?9,
        excerpt = ?10,
        featured_image = ?11
      WHERE id = ?1
    `)
      .bind(1, post.id)
      .bind(2, post.title)
      .bind(3, post.content)
      .bind(4, post.slug)
      .bind(5, post.datetime)
      .bind(6, post.modified)
      .bind(7, post.type)
      .bind(8, post.categories)
      .bind(9, post.tags)
      .bind(10, post.excerpt)
      .bind(11, post.featured_image);

  try {
    const result = await statement.run();

    console.log(`post ${post.id} is updated`);
  } catch(e) {
    console.log(`unable to update: ${JSON.stringify(e)}`)
  }
}

const savePost = async ( postId ) => {
  const api = `https://cms.jirayu.in.th/wp-json/wp/v2/posts/${postId}`;
  const response = await fetch( api );
  const data = await response.json();

  console.log( `post id: ${postId}`);

  const statement = env.DB.prepare('SELECT ID, modified from `web_posts` WHERE `ID` = 1').bind(postId);
  const row = await statement.first();

  const post = {
    ID: data.id,
    title: data.title.rendered,
    content: data.content.rendered,
    slug: data.slug,
    datetime: data.date_gmt,
    modified: data.modified_gmt,
    type: 'post',
    categories: data.categories.join(','),
    tags:  data.tags.join(','),
    excerpt: data.excerpt.rendered,
    featured_image: data.jetpack_featured_media_url,
    meta: '',
  }

  return;

  if ( !row ) {
    await insertPost(post);
  } else if ( row && post.modified !== row.modified) {
    await updatePost(post);
  }
}

export default {
  async fetch(req, env, ctx) {
    const lastFetch = await env.KV.get('lastFetch') ?? 0;
    const current = Math.floor((Date.now()) / 1000);

    console.log(`last: ${lastFetch} / now: ${current}`);

    if ( current - lastFetch <= 30 ) {
      return Response.json({
        message: 'rate limit'
      });
    }

    ctx.waitUntil(sendToQueue());

    env.KV.put('lastFetch', current);

    return Response.json({
      message: 'Sync queued'
    });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendToQueue());
  },

  async queue( batch, env, ctx ) {
    for (const message of batch.messages) {
      console.log( `queue triggered: ${message.body.id}`);

      ctx.waitUntil( savePost(message.body.id) );
    }
  }
};
