import { createLinearAdapter } from "@chat-adapter/linear";
import { Chat } from "chat";
import { BacklogAdapter } from "chat-adapter-backlog";

export const bot = new Chat({
  userName: process.env.BOT_USERNAME ?? "chat-bot",
  adapters: {
    backlog: new BacklogAdapter({
      host: process.env.BACKLOG_HOST!,
      apiKey: process.env.BACKLOG_API_KEY!,
    }),
    linear: createLinearAdapter(),
  },
});

bot.onNewMention(async (thread, message) => {
  await thread.subscribe();
  await thread.post(`Received: "${message.text}"`);
});

bot.onSubscribedMessage(async (thread, message) => {
  await thread.post(`Got follow-up: "${message.text}"`);
});
