import { JsonRpcProvider } from "ethers";
import { getTokenMetadata } from "./ethereum";
import { TokenMetadata } from "./types";

export class TokenMetadataCache {
  private readonly provider: JsonRpcProvider;
  private readonly cache = new Map<string, Promise<TokenMetadata>>();

  constructor(provider: JsonRpcProvider) {
    this.provider = provider;
  }

  get(address: string): Promise<TokenMetadata> {
    const normalized = address.toLowerCase();
    const cached = this.cache.get(normalized);
    if (cached) {
      return cached;
    }

    const pending = getTokenMetadata(address, this.provider);
    this.cache.set(normalized, pending);
    return pending;
  }
}
