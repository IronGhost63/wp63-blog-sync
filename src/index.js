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

		postList.forEach( async (post) => await env.QUEUE.send(post));

		console.log(`data sent to queue: ${JSON.stringify(postList)}`);
	},

	async queue( batch, env, ctx ) {
		const {message} = batch;
		console.log( `queue triggered: ${message.body.id}`);
	}
};
