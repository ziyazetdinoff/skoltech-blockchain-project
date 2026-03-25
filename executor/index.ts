import { loadRuntimeConfig } from "../src/common/env";
import { createProvider, createWallet } from "../src/common/ethereum";
import { StateRepository } from "../src/storage/sqlite";
import { ExecutorService } from "./services/ExecutorService";

async function main(): Promise<void> {
  const config = loadRuntimeConfig();
  const provider = createProvider(config.rpcUrl);
  const wallet = createWallet(config.backendPrivateKey, provider);
  const repository = new StateRepository(config.sqlitePath);
  const executor = new ExecutorService(config, repository, provider, wallet);

  const runOnce = async () => {
    try {
      await executor.runOnce();
    } catch (error) {
      console.error("[executor:error] fatal scan failure", error);
      repository.log("error", "Fatal executor scan failure", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const onceMode = process.argv.includes("--once");
  if (onceMode) {
    await runOnce();
    repository.close();
    return;
  }

  await runOnce();
  const timer = setInterval(() => {
    void runOnce();
  }, config.executorPollIntervalMs);

  const shutdown = () => {
    clearInterval(timer);
    repository.close();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void main();
