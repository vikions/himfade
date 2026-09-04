import type { NadoClient } from '@nadohq/client';
import {
  IndexerClient,
  type IndexerLiquidationEvent,
  type IndexerOrder,
} from '@nadohq/indexer-client';
import { ProductEngineType } from '@nadohq/shared';
import Decimal from 'decimal.js';
import type {
  NadoPerformanceHistory,
  NadoSignalDataSource,
} from './signal-feed';
import type {
  ActivePosition,
  CandidateScore,
  ClosedOrder,
  ObservedMatch,
} from './signal-ranking';

const X18 = new Decimal(10).pow(18);
const PAGE_SIZE = 200;

export class NadoSignalSource implements NadoSignalDataSource {
  private symbolsByProductId?: Promise<Map<number, string>>;

  constructor(
    private readonly indexer: Pick<
      IndexerClient,
      | 'getMatchEvents'
      | 'getPaginatedSubaccountOrders'
      | 'getPaginatedSubaccountLiquidationEvents'
    >,
    private readonly client: Pick<NadoClient, 'market' | 'subaccount'>,
  ) {}

  async getRecentMatches(input: { limit: number }): Promise<ObservedMatch[]> {
    const matches = await this.indexer.getMatchEvents({ limit: input.limit });

    return matches
      .filter(
        (match) =>
          match.postBalances.base.type === ProductEngineType.PERP &&
          !match.isolated,
      )
      .map((match) => ({
        subaccountOwner: match.subaccountOwner,
        subaccountName: match.subaccountName,
        realizedPnlUsd: fromX18(match.realizedPnl.toFixed()),
        timestamp: Number(match.timestamp.toFixed()) * 1_000,
        isolated: match.isolated,
      }));
  }

  async getActivePosition(
    candidate: CandidateScore,
  ): Promise<ActivePosition | null> {
    const summary = await this.client.subaccount.getSubaccountSummary({
      subaccountOwner: candidate.subaccountOwner,
      subaccountName: candidate.subaccountName,
    });
    if (!summary.exists) return null;

    const symbols = await this.getSymbolsByProductId();
    const positions = summary.balances
      .filter(
        (balance) =>
          balance.type === ProductEngineType.PERP && !balance.amount.isZero(),
      )
      .map((balance): ActivePosition | null => {
        const symbol = symbols.get(balance.productId);
        if (!symbol) return null;
        const baseAmount = fromX18(balance.amount.abs().toFixed());
        const oraclePrice = fromX18(balance.oraclePrice.toFixed());
        return {
          symbol,
          productId: balance.productId,
          side: balance.amount.isPositive() ? 'long' : 'short',
          baseAmount,
          notionalUsd: round(baseAmount * oraclePrice, 2),
        };
      })
      .filter((position): position is ActivePosition => position !== null)
      .sort((a, b) => b.notionalUsd - a.notionalUsd);

    return positions[0] ?? null;
  }

  async getPerformanceHistory(
    candidate: CandidateScore,
    input: { since: number; until: number; maxRecords: number },
  ): Promise<NadoPerformanceHistory> {
    const [orderHistory, liquidationHistory] = await Promise.all([
      this.getOrders(candidate, input),
      this.getLiquidations(candidate, input),
    ]);

    return {
      orders: orderHistory.items,
      liquidationTimestamps: liquidationHistory.items,
      historyComplete:
        orderHistory.windowComplete && liquidationHistory.windowComplete,
    };
  }

  private async getSymbolsByProductId() {
    this.symbolsByProductId ??= this.client.market
      .getSymbols({ productType: ProductEngineType.PERP })
      .then(
        ({ symbols }) =>
          new Map(
            Object.entries(symbols).map(([symbol, market]) => [
              market.productId,
              symbol,
            ]),
          ),
      );
    return this.symbolsByProductId;
  }

  private async getOrders(
    candidate: CandidateScore,
    input: { since: number; until: number; maxRecords: number },
  ) {
    const items: ClosedOrder[] = [];
    let cursor: string | undefined;
    let windowComplete = false;

    while (items.length < input.maxRecords) {
      const response = await this.indexer.getPaginatedSubaccountOrders({
        subaccountOwner: candidate.subaccountOwner,
        subaccountName: candidate.subaccountName,
        isolated: false,
        maxTimestampInclusive: Math.floor(input.until / 1_000),
        startCursor: cursor,
        limit: Math.min(PAGE_SIZE, input.maxRecords - items.length),
      });
      const page = response.orders
        .map(normalizeOrder)
        .filter((order) => order.timestamp > 0);
      items.push(...page.filter((order) => order.timestamp >= input.since));

      if (page.some((order) => order.timestamp < input.since)) {
        windowComplete = true;
        break;
      }
      if (!response.meta.hasMore) {
        windowComplete = true;
        break;
      }
      if (!response.meta.nextCursor) break;
      cursor = response.meta.nextCursor;
    }

    return { items: items.slice(0, input.maxRecords), windowComplete };
  }

  private async getLiquidations(
    candidate: CandidateScore,
    input: { since: number; until: number; maxRecords: number },
  ) {
    const items: number[] = [];
    let cursor: string | undefined;
    let windowComplete = false;

    while (items.length < input.maxRecords) {
      const response =
        await this.indexer.getPaginatedSubaccountLiquidationEvents({
          subaccountOwner: candidate.subaccountOwner,
          subaccountName: candidate.subaccountName,
          maxTimestampInclusive: Math.floor(input.until / 1_000),
          startCursor: cursor,
          limit: Math.min(PAGE_SIZE, input.maxRecords - items.length),
        });
      const page = response.events.map(normalizeLiquidationTimestamp);
      items.push(...page.filter((timestamp) => timestamp >= input.since));

      if (page.some((timestamp) => timestamp < input.since)) {
        windowComplete = true;
        break;
      }
      if (!response.meta.hasMore) {
        windowComplete = true;
        break;
      }
      if (!response.meta.nextCursor) break;
      cursor = response.meta.nextCursor;
    }

    return { items: items.slice(0, input.maxRecords), windowComplete };
  }
}

function normalizeOrder(order: IndexerOrder): ClosedOrder {
  return {
    timestamp: Number(order.lastFillTimestamp.toFixed()) * 1_000,
    realizedPnlUsd: fromX18(order.realizedPnl.toFixed()),
    closedAmount: fromX18(order.closedAmount.toFixed()),
  };
}

function normalizeLiquidationTimestamp(event: IndexerLiquidationEvent) {
  return Number(event.timestamp.toFixed()) * 1_000;
}

function fromX18(value: string) {
  return new Decimal(value).div(X18).toNumber();
}

function round(value: number, decimals: number) {
  return new Decimal(value).toDecimalPlaces(decimals).toNumber();
}
