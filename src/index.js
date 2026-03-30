import { Hono } from "hono";
import { bearerAuth } from 'hono/bearer-auth';
import { env, waitUntil } from "cloudflare:workers";
import api from "./api";

const app = new Hono();

app.get("/sync", async (c) => {
  const lastFetch = await env.KV.get('lastFetch') ?? 0;
  const current = Math.floor((Date.now()) / 1000);

  if ( current - lastFetch <= 30 ) {
    return c.json({
      message: 'rate limit'
    });
  }

  waitUntil(api.sendToQueue());

  env.KV.put('lastFetch', current);

  return c.json({
    message: 'Sync queued'
  });
});

app.get("/contents", bearerAuth({ token: env.API_KEY }), async (c) => {
  const { results } = await env.DB.prepare('SELECT * FROM web_posts ORDER BY datetime DESC').run();

  return c.json({
    posts: results
  });
});

const worker = {
  async scheduled() {
    console.log('before schedule');``
    waitUntil(api.sendToQueue());
    console.log('after schedule');
  },

  async queue( batch ) {
    for (const message of batch.messages) {
      waitUntil( api.savePost(message.body.id) );
    }
  }
}

export default {...app, ...worker};
