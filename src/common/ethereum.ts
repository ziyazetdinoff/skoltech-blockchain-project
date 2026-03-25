import { Contract, JsonRpcProvider, MaxUint256, Wallet, formatUnits } from "ethers";
import { DCA_PLAN_MANAGER_ABI, ERC20_ABI } from "./abi";
import { TokenMetadata } from "./types";

export function createProvider(rpcUrl: string): JsonRpcProvider {
  return new JsonRpcProvider(rpcUrl);
}

export function createWallet(privateKey: string, provider: JsonRpcProvider): Wallet {
  return new Wallet(privateKey, provider);
}

export function getDcaManagerContract(address: string, runner: Contract["runner"]): Contract {
  return new Contract(address, DCA_PLAN_MANAGER_ABI, runner);
}

export function getErc20Contract(address: string, runner: Contract["runner"]): Contract {
  return new Contract(address, ERC20_ABI, runner);
}

export async function ensureAllowance(
  tokenAddress: string,
  owner: Wallet,
  spender: string,
  requiredAmount: bigint,
): Promise<void> {
  const token = getErc20Contract(tokenAddress, owner);
  const allowance = await token.allowance(owner.address, spender) as bigint;

  if (allowance >= requiredAmount) {
    return;
  }

  const resetTx = await token.approve(spender, 0);
  await resetTx.wait();

  const approveTx = await token.approve(spender, MaxUint256);
  await approveTx.wait();
}

export async function getTokenMetadata(address: string, runner: Contract["runner"]): Promise<TokenMetadata> {
  const token = getErc20Contract(address, runner);
  const [symbol, decimals] = await Promise.all([
    token.symbol() as Promise<string>,
    token.decimals() as Promise<number>,
  ]);

  return {
    address,
    symbol,
    decimals,
  };
}

export function formatTokenAmount(amount: bigint, decimals: number, fractionDigits = 6): string {
  const numeric = Number(formatUnits(amount, decimals));
  if (!Number.isFinite(numeric)) {
    return formatUnits(amount, decimals);
  }

  return numeric.toFixed(fractionDigits).replace(/\.?0+$/, "");
}
