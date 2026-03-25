import { Telegraf } from "telegraf";
import { loadBotConfig } from "../src/common/env";
import { createProvider } from "../src/common/ethereum";
import { StateRepository } from "../src/storage/sqlite";
import { registerCommands } from "./commands/registerCommands";
import { BotSessionStore } from "./services/BotSessionStore";
import { DcaBotService } from "./services/DcaBotService";

async function main(): Promise<void> {
  console.log("[bot:debug] Loading config...");
  const config = loadBotConfig();
  console.log("[bot:debug] Config loaded. Creating provider...");
  const provider = createProvider(config.rpcUrl);
  console.log("[bot:debug] Provider created. Opening repository...");
  const repository = new StateRepository(config.sqlitePath);
  console.log("[bot:debug] Repository opened. Creating service...");
  const service = new DcaBotService(config, provider, repository);
  console.log("[bot:debug] Service created. Creating session store...");
  const sessions = new BotSessionStore();
  console.log("[bot:debug] Session store created. Creating Telegraf instance...");
  const bot = new Telegraf(config.telegramBotToken);

  console.log("[bot:debug] Registering commands...");
  registerCommands(bot, service, sessions, config);
  console.log("[bot:debug] Commands registered. Launching bot...");

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
