import { Telegraf } from "telegraf";
import { loadBotConfig } from "../src/common/env";
import { createProvider } from "../src/common/ethereum";
import { StateRepository } from "../src/storage/sqlite";
import { registerCommands } from "./commands/registerCommands";
import { BotSessionStore } from "./services/BotSessionStore";
import { DcaBotService } from "./services/DcaBotService";

async function main(): Promise<void> {
  const config = loadBotConfig();
  const provider = createProvider(config.rpcUrl);
  const repository = new StateRepository(config.sqlitePath);
  const service = new DcaBotService(config, provider, repository);
  const sessions = new BotSessionStore();
  const bot = new Telegraf(config.telegramBotToken);

  registerCommands(bot, service, sessions, config);

  await bot.launch();
  console.log("[bot:info] Telegram bot started");

  const shutdown = async () => {
    bot.stop();
    repository.close();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

void main();
