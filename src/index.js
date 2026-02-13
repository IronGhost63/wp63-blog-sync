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

export default {
	async fetch(req) {
		const url = new URL(req.url)
		url.pathname = "/__scheduled";
		url.searchParams.append("cron", "* * * * *");
		return new Response(`To test the scheduled handler, ensure you have used the "--test-scheduled" then try running "curl ${url.href}".`);
	},

	// The scheduled handler is invoked at the interval set in our wrangler.jsonc's
	// [[triggers]] configuration.
	async scheduled(event, env, ctx) {
		const url = 'https://cms.jirayu.in.th/wp-json/wp/v2/posts?_fields=id&per_page=100';
		const response = await fetch(url);

		if ( !response.ok ) {
			console.log('Failed to retrieve post list');

			return;
		}

		const postList = await response.json();

		postList.forEach( async (post) => {
			console.log('prep');

			const payload = {
				id: post.id,
				text: 'hello world'
			}

			try {
				console.log('sending');

				await env.SYNC_QUEUE.send(payload);
			} catch (e) {
				const message = e instanceof Error ? e.message : "Unknown error";

      	console.error(`failed to send to the queue: ${message}`);
			}

			console.log(`payload: ${JSON.stringify(payload)}`)
			// ctx.waitUntil(env.QUEUE.send(post));
		});

		console.log(`data sent to queue`);
	},

	async queue( batch, env, ctx ) {
    for (const message of batch.messages) {
      console.log( `queue triggered: ${message.body.id}`);
    }
	}
};
