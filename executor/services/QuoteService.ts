import { Contract, JsonRpcProvider } from "ethers";
import { QUOTER_V1_ABI, QUOTER_V2_ABI } from "../../src/common/abi";
import { describeError } from "../../src/common/errors";

export interface QuoteRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  fee: number;
}

export class QuoteService {
  private readonly quoterV1: Contract;
  private readonly quoterV2: Contract;

  constructor(quoterAddress: string, provider: JsonRpcProvider) {
    this.quoterV1 = new Contract(quoterAddress, QUOTER_V1_ABI, provider);
    this.quoterV2 = new Contract(quoterAddress, QUOTER_V2_ABI, provider);
  }

  async quoteExactInputSingle(request: QuoteRequest): Promise<bigint> {
    try {
      const [amountOut] = await this.quoterV2.quoteExactInputSingle.staticCall({
        tokenIn: request.tokenIn,
        tokenOut: request.tokenOut,
        amountIn: request.amountIn,
        fee: request.fee,
        sqrtPriceLimitX96: 0,
      }) as [bigint, bigint, number, bigint];

      return amountOut;
    } catch (v2Error) {
      try {
        return await this.quoterV1.quoteExactInputSingle.staticCall(
          request.tokenIn,
          request.tokenOut,
          request.fee,
          request.amountIn,
          0,
        ) as bigint;
      } catch (v1Error) {
        throw new Error(
          `Unable to fetch swap quote. QuoterV2 error: ${describeError(v2Error)}. QuoterV1 error: ${describeError(v1Error)}`,
        );
      }
    }
  }
}
