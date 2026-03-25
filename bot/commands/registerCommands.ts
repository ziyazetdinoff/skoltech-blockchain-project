import { Markup, Telegraf } from "telegraf";
import { BotConfig } from "../../src/common/env";
import { DcaBotService } from "../services/DcaBotService";
import { BotSession, BotSessionStore } from "../services/BotSessionStore";
import { PlanStatus } from "../../src/common/types";

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
        return "Enter `totalBudget` in PYUSD.";
      case "totalBudget":
        session.draft.totalBudget = input;
        sessions.set(userId, { ...session, step: "intervalSeconds" });
        return "Enter `intervalSeconds` as an integer.";
      case "intervalSeconds":
        session.draft.intervalSeconds = parsePositiveInteger(input, "Interval");
        sessions.set(userId, { ...session, step: "slippageBps" });
        return "Enter `slippageBps` as an integer (e.g., 100 for 1%).";
      case "slippageBps":
        session.draft.slippageBps = parsePositiveInteger(input, "Slippage");
        sessions.set(userId, { ...session, step: "recipient" });
        return "Enter recipient address or `me`.";
      case "recipient":
        if (!isValidAddress(input)) {
          throw new Error("Recipient must be a valid address or `me`.");
        }
        session.draft.recipient = input;
        sessions.set(userId, { ...session, step: "startTime" });
        return "Enter start time: `now`, unix timestamp, or ISO datetime.";
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
      return "Enter new `intervalSeconds`.";
    case "intervalSeconds":
      session.draft.intervalSeconds = parsePositiveInteger(input, "Interval");
      sessions.set(userId, { ...session, step: "slippageBps" });
      return "Enter new `slippageBps`.";
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

function planActionKeyboard(planId: number, status: PlanStatus) {
  const buttons = [];

  if (status === "Active") {
    buttons.push(
      Markup.button.callback("Pause", `plan:pause:${planId}`),
      Markup.button.callback("Cancel", `plan:cancel:${planId}`),
    );
  } else if (status === "Paused") {
    buttons.push(
      Markup.button.callback("Resume", `plan:resume:${planId}`),
      Markup.button.callback("Cancel", `plan:cancel:${planId}`),
    );
  }

  buttons.push(Markup.button.callback("Refresh", `plan:refresh:${planId}`));

  return Markup.inlineKeyboard(buttons, { columns: status === "Canceled" || status === "Completed" ? 1 : 2 });
}

async function renderPlanCard(ctx: any, service: DcaBotService, planId: number): Promise<void> {
  const card = await service.getPlanCard(planId);
  await ctx.reply(card.text, planActionKeyboard(planId, card.status));
}

async function editPlanCard(ctx: any, service: DcaBotService, planId: number): Promise<void> {
  const card = await service.getPlanCard(planId);
  try {
    await ctx.editMessageText(card.text, {
      reply_markup: planActionKeyboard(planId, card.status).reply_markup,
    });
  } catch (error) {
    const message = service.formatError(error);
    if (message.toLowerCase().includes("message is not modified")) {
      await ctx.answerCbQuery("Plan is already up to date.");
      return;
    }

    throw error;
  }
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
      await renderPlanCard(ctx, service, Number(args[0]));
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
    console.log(`[bot:debug] User ${ctx.from.id} started /create`);
    sessions.set(ctx.from.id, {
      kind: "create",
      step: "amountPerInterval",
      draft: {},
    });
    console.log(`[bot:debug] Create session initiated for ${ctx.from.id}`);
    await ctx.reply("Enter `amountPerInterval` in PYUSD.");
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
    await ctx.reply("Enter new `amountPerInterval` in PYUSD.");
  });

  bot.action(/^plan:(refresh|pause|resume|cancel):(\d+)$/, async (ctx) => {
    const [, action, rawPlanId] = ctx.match;
    const planId = Number(rawPlanId);

    try {
      if (action === "pause") {
        const message = await service.pausePlan(planId);
        await ctx.answerCbQuery(message.split("\n")[0]);
      } else if (action === "resume") {
        const message = await service.resumePlan(planId);
        await ctx.answerCbQuery(message.split("\n")[0]);
      } else if (action === "cancel") {
        const message = await service.cancelPlan(planId);
        await ctx.answerCbQuery(message.split("\n")[0]);
      } else {
        await ctx.answerCbQuery("Plan refreshed.");
      }

      await editPlanCard(ctx, service, planId);
    } catch (error) {
      await ctx.answerCbQuery(service.formatError(error).slice(0, 180), {
        show_alert: true,
      });
    }
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
      console.log(`[bot:debug] User ${ctx.from.id} sent input: ${text} for step ${session.step}`);
      const response = await handleSessionInput(service, sessions, ctx.from.id, session, text);
      console.log(`[bot:debug] Response generated: ${response}`);
      await ctx.reply(response);
    } catch (error) {
      sessions.clear(ctx.from.id);
      await ctx.reply(`Session aborted: ${service.formatError(error)}`);
    }
  });
}
