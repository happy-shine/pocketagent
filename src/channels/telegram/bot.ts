import { Bot } from "grammy";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";
import type { Logger } from "pino";

const ipv4Agent = new https.Agent({
  family: 4,
  keepAlive: true,
  keepAliveMsecs: 10000,
});

export function createBot(token: string, log: Logger): Bot {
  const proxy = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
  const bot = new Bot(token, {
    client: {
      baseFetchConfig: { agent: proxy ? new HttpsProxyAgent(proxy) : ipv4Agent },
    },
  });
  bot.api.config.use(apiThrottler());
  bot.catch((err) => {
    log.error({ error: err.message }, "Telegram Bot error");
  });
  return bot;
}
