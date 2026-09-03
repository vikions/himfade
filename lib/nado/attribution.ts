import type { NadoClient } from '@nadohq/client';
import { parseAbi, parseAbiItem } from 'viem';
import { decodeNadoAppendix } from './appendix';

const endpointAbi = parseAbi([
  'function getOffchainExchange() view returns (address)',
]);
const offchainExchangeAbi = parseAbi([
  'function getClaimableBuilderFee(uint32 quoteId, uint32 builderId) view returns (int128)',
]);
const builderFeePaymentEvent = parseAbiItem(
  'event BuilderFeePayment(bytes32 indexed subaccount, uint32 indexed builder, uint32 indexed productId, bytes32 digest, int128 feeAmount, int128 feeRate)',
);

export async function getNadoAttributionEvidence(input: {
  client: NadoClient;
  builderId: number;
  digest?: string;
}) {
  const publicClient = input.client.context.publicClient;
  const offchainExchange = await publicClient.readContract({
    address: input.client.context.contractAddresses.endpoint,
    abi: endpointAbi,
    functionName: 'getOffchainExchange',
  });
  const claimable = await publicClient.readContract({
    address: offchainExchange,
    abi: offchainExchangeAbi,
    functionName: 'getClaimableBuilderFee',
    args: [0, input.builderId],
  });
  const events = input.digest
    ? (
        await publicClient.getLogs({
          address: offchainExchange,
          event: builderFeePaymentEvent,
          args: { builder: input.builderId },
          fromBlock: 'earliest',
          toBlock: 'latest',
        })
      ).filter(
        (event) =>
          event.args.digest?.toLowerCase() === input.digest?.toLowerCase(),
      )
    : [];
  return { offchainExchange, claimable: claimable.toString(), events };
}

export function proveNadoOrderAppendix(appendix: bigint | string) {
  return decodeNadoAppendix(appendix);
}
