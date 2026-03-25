import { Telegraf } from "telegraf";
import { BotConfig } from "../../src/common/env";
import { DcaBotService } from "../services/DcaBotService";
import { BotSession, BotSessionStore } from "../services/BotSessionStore";

function getArgs(text: string): string[] {
  return text.trim().split(/\s+/).slice(1);
}

function isAllowedUser(config: BotConfig, telegramUserId?: number): boolean {
  return telegramUserId !== undefined && String(telegramUserId) === config.telegramAllowedUserId;
}

function isValidAddress(value: string): boolean {
  return value.toLowerCase() === "me" || /^0x[a-fA-F0-9]{40}$/.test(value);
}

function parsePositiveInteger(input: string, label: string): number {
  const parsed = Number(input);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
}

function parseStartTime(input: string): bigint {
  if (input.toLowerCase() === "now") {
    return BigInt(Math.floor(Date.now() / 1000));
  }
  if (/^\d+$/.test(input)) {
    return BigInt(input);
  }

  const parsed = Date.parse(input);
  if (Number.isNaN(parsed)) {
    throw new Error("Start time must be `now`, unix timestamp or ISO datetime.");
  }

  return BigInt(Math.floor(parsed / 1000));
}

async function handleSessionInput(
  service: DcaBotService,
  sessions: BotSessionStore,
  userId: number,
  session: BotSession,
  input: string,
): Promise<string> {
  if (session.kind === "create") {
    switch (session.step) {
      case "amountPerInterval":
        session.draft.amountPerInterval = input;
        sessions.set(userId, { ...session, step: "totalBudget" });
        return "Введите `totalBudget` в USDC.";
      case "totalBudget":
        session.draft.totalBudget = input;
        sessions.set(userId, { ...session, step: "intervalSeconds" });
        return "Введите `intervalSeconds` целым числом.";
      case "intervalSeconds":
        session.draft.intervalSeconds = parsePositiveInteger(input, "Interval");
        sessions.set(userId, { ...session, step: "slippageBps" });
        return "Введите `slippageBps` целым числом.";
      case "slippageBps":
        session.draft.slippageBps = parsePositiveInteger(input, "Slippage");
        sessions.set(userId, { ...session, step: "recipient" });
        return "Введите адрес recipient или `me`.";
      case "recipient":
        if (!isValidAddress(input)) {
          throw new Error("Recipient must be a valid address or `me`.");
        }
        session.draft.recipient = input;
        sessions.set(userId, { ...session, step: "startTime" });
        return "Введите время старта: `now`, unix timestamp или ISO datetime.";
      case "startTime": {
        session.draft.startTime = parseStartTime(input);
        sessions.clear(userId);
        return service.createPlan({
          amountPerInterval: session.draft.amountPerInterval!,
          totalBudget: session.draft.totalBudget!,
          intervalSeconds: session.draft.intervalSeconds!,
          slippageBps: session.draft.slippageBps!,
          recipient: session.draft.recipient!,
          startTime: session.draft.startTime,
        });
      }
      default:
        throw new Error("Unsupported create session step.");
    }
  }

  switch (session.step) {
    case "amountPerInterval":
      session.draft.amountPerInterval = input;
      sessions.set(userId, { ...session, step: "intervalSeconds" });
      return "Введите новый `intervalSeconds`.";
    case "intervalSeconds":
      session.draft.intervalSeconds = parsePositiveInteger(input, "Interval");
      sessions.set(userId, { ...session, step: "slippageBps" });
      return "Введите новый `slippageBps`.";
    case "slippageBps":
      session.draft.slippageBps = parsePositiveInteger(input, "Slippage");
      sessions.clear(userId);
      return service.updatePlan(session.planId, {
        amountPerInterval: session.draft.amountPerInterval!,
        intervalSeconds: session.draft.intervalSeconds!,
        slippageBps: session.draft.slippageBps!,
      });
    default:
      throw new Error("Unsupported update session step.");
  }
}

function helpText(service: DcaBotService): string {
  return [
    "DCA MVP bot commands:",
    `/start`,
    `/help`,
    `/plans`,
    `/plan <id>`,
    `/pause <id>`,
    `/resume <id>`,
    `/cancel <id>`,
    `/topup <id> <amount>`,
    `/withdraw <id> <amount>`,
    `/create`,
    `/update <id>`,
    "",
    `Configured wallet: ${service.getWalletAddress()}`,
    "Create flow asks for: amountPerInterval, totalBudget, intervalSeconds, slippageBps, recipient, startTime.",
    "Update flow asks for: amountPerInterval, intervalSeconds, slippageBps.",
  ].join("\n");
}

export function registerCommands(
  bot: Telegraf,
  service: DcaBotService,
  sessions: BotSessionStore,
  config: BotConfig,
): void {
  bot.use(async (ctx, next) => {
    if (!isAllowedUser(config, ctx.from?.id)) {
      await ctx.reply("Access denied for this Telegram account.");
      return;
    }

    await next();
  });

  bot.start(async (ctx) => {
    await ctx.reply(helpText(service));
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(helpText(service));
  });

  bot.command("plans", async (ctx) => {
    try {
      await ctx.reply(await service.listPlans());
    } catch (error) {
      await ctx.reply(service.formatError(error));
    }
  });

  bot.command("plan", async (ctx) => {
    const args = getArgs(ctx.message.text);
    if (args.length !== 1) {
      await ctx.reply("Usage: /plan <id>");
      return;
    }

    try {
      await ctx.reply(await service.getPlanDetails(Number(args[0])));
    } catch (error) {
      await ctx.reply(service.formatError(error));
    }
  });

  bot.command("pause", async (ctx) => {
    const args = getArgs(ctx.message.text);
    if (args.length !== 1) {
      await ctx.reply("Usage: /pause <id>");
      return;
    }

    try {
      await ctx.reply(await service.pausePlan(Number(args[0])));
    } catch (error) {
      await ctx.reply(service.formatError(error));
    }
  });

  bot.command("resume", async (ctx) => {
    const args = getArgs(ctx.message.text);
    if (args.length !== 1) {
      await ctx.reply("Usage: /resume <id>");
      return;
    }

    try {
      await ctx.reply(await service.resumePlan(Number(args[0])));
    } catch (error) {
      await ctx.reply(service.formatError(error));
    }
  });

  bot.command("cancel", async (ctx) => {
    const args = getArgs(ctx.message.text);
    if (args.length !== 1) {
      await ctx.reply("Usage: /cancel <id>");
      return;
    }

    try {
      await ctx.reply(await service.cancelPlan(Number(args[0])));
    } catch (error) {
      await ctx.reply(service.formatError(error));
    }
  });

  bot.command("topup", async (ctx) => {
    const args = getArgs(ctx.message.text);
    if (args.length !== 2) {
      await ctx.reply("Usage: /topup <id> <amount>");
      return;
    }

    try {
      await ctx.reply(await service.topUpPlan(Number(args[0]), args[1]));
    } catch (error) {
      await ctx.reply(service.formatError(error));
    }
  });

  bot.command("withdraw", async (ctx) => {
    const args = getArgs(ctx.message.text);
    if (args.length !== 2) {
      await ctx.reply("Usage: /withdraw <id> <amount>");
      return;
    }

    try {
      await ctx.reply(await service.withdrawUnusedFunds(Number(args[0]), args[1]));
    } catch (error) {
      await ctx.reply(service.formatError(error));
    }
  });

  bot.command("create", async (ctx) => {
    sessions.set(ctx.from.id, {
      kind: "create",
      step: "amountPerInterval",
      draft: {},
    });
    await ctx.reply("Введите `amountPerInterval` в USDC.");
  });

  bot.command("update", async (ctx) => {
    const args = getArgs(ctx.message.text);
    if (args.length !== 1) {
      await ctx.reply("Usage: /update <id>");
      return;
    }

    sessions.set(ctx.from.id, {
      kind: "update",
      planId: Number(args[0]),
      step: "amountPerInterval",
      draft: {},
    });
    await ctx.reply("Введите новый `amountPerInterval` в USDC.");
  });

  bot.on("text", async (ctx, next) => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) {
      await next();
      return;
    }

    const session = sessions.get(ctx.from.id);
    if (!session) {
      await next();
      return;
    }

    try {
      const response = await handleSessionInput(service, sessions, ctx.from.id, session, text);
      await ctx.reply(response);
    } catch (error) {
      sessions.clear(ctx.from.id);
      await ctx.reply(`Session aborted: ${service.formatError(error)}`);
    }
  });
}
