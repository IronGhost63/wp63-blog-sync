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

const savePost = async ( postId ) => {
  const api = `https://cms.jirayu.in.th/wp-json/wp/v2/posts/${postId}`;
  const response = await fetch( api );
  const data = await response.json();

  console.log(`fetch ${postId} - ${data.title.rendered}`);

  const statement = env.DB.prepare('SELECT ID from `web_posts` WHERE `ID` = ?').bind(postId);
  const savedId = await statement.first('ID');

  console.log(savedId ?? `not exists`);
}

export default {
  async fetch(req, env, ctx) {
    const lastFetch = env.KV.get('lastFetch') ?? 0;
    const current = Math.floor((Date.now()) / 1000);

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
