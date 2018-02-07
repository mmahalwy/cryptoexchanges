import keyBy from 'lodash/keyBy';
import get from 'lodash/get';
import lowerCase from 'lodash/lowerCase';
import sum from 'lodash/sum';

import ExchangeError from '../base/errors/ExchangeError';
import BaseParser from '../base/BaseParser';
import { iso8601, milliseconds } from '../../utils/time';
import { precisionFromString } from '../../utils/number';
import {
  NULL_ID,
  ORDER_TYPE,
  MARKET_STATUS,
  ORDER_STATUSES,
  FEES,
} from './constants';

class BinanceParser extends BaseParser {
  parseTicker = (ticker, market) => {
    let symbol;
    let scopedMarket = market;
    let timestamp = parseFloat(ticker.closeTime);

    if (!timestamp) {
      timestamp = milliseconds();
    }

    // eslint-disable-next-line prefer-destructuring
    symbol = ticker.symbol;

    if (!market) {
      if (this.exchange.marketsById[symbol]) {
        scopedMarket = this.exchange.marketsById[symbol];
      }
    }

    if (market) {
      // eslint-disable-next-line prefer-destructuring
      symbol = scopedMarket.symbol;
    }

    return {
      symbol,
      timestamp,
      datetime: iso8601(timestamp),
      high: parseFloat(ticker.highPrice),
      low: parseFloat(ticker.lowPrice),
      bid: parseFloat(ticker.bidPrice),
      bidVolume: parseFloat(ticker.bidQty),
      ask: parseFloat(ticker.askPrice),
      askVolume: parseFloat(ticker.askQty),
      vwap: parseFloat(ticker.weightedAvgPrice),
      open: parseFloat(ticker.openPrice),
      close: parseFloat(ticker.prevClosePrice),
      first: undefined,
      last: parseFloat(ticker.lastPrice),
      change: parseFloat(ticker.priceChangePercent),
      percentage: undefined,
      average: undefined,
      baseVolume: parseFloat(ticker.volume),
      quoteVolume: parseFloat(ticker.quoteVolume),
      ...this.infoField(ticker),
    };
  };

  parseTickers = (rawTickers, symbols = undefined) => {
    const tickers = [];

    rawTickers.forEach((rawTicker) => {
      tickers.push(this.parseTicker(rawTicker));
    });

    const tickersBySymbol = keyBy(tickers, 'symbol');
    // return all of them if no symbols were passed in the first argument
    if (!symbols) return tickersBySymbol;
    // otherwise filter by symbol
    const result = {};

    symbols.forEach((symbol) => {
      if (tickersBySymbol[symbol]) {
        result[symbol] = tickersBySymbol[symbol];
      }
    });

    return result;
  };

  parseOHLCV = ohlcv => [
    ohlcv[0],
    parseFloat(ohlcv[1]),
    parseFloat(ohlcv[2]),
    parseFloat(ohlcv[3]),
    parseFloat(ohlcv[4]),
    parseFloat(ohlcv[5]),
  ];

  parseOrderStatus = (status) => {
    if (status === ORDER_STATUSES.NEW) return 'open';
    if (status === ORDER_STATUSES.PARTIALLY_FILLED) return 'open';
    if (status === ORDER_STATUSES.FILLED) return 'closed';
    if (status === ORDER_STATUSES.CANCELED) return 'canceled';

    return lowerCase(status);
  };

  parseOrder = (order, market) => {
    let symbol;
    let timestamp;
    let scopedMarket = market;
    let status = get(order, 'status');

    if (status) {
      status = this.parseOrderStatus(status);
    }

    if (scopedMarket) {
      // eslint-disable-next-line prefer-destructuring
      symbol = scopedMarket.symbol;
    } else {
      const id = order.symbol;
      if (this.exchange.marketsById[id]) {
        // eslint-disable-next-line prefer-destructuring
        scopedMarket = this.exchange.marketsById[id];
        // eslint-disable-next-line prefer-destructuring
        symbol = scopedMarket.symbol;
      }
    }

    if (order.time) {
      timestamp = order.time;
    } else if (order.transactTime) {
      timestamp = order.transactTime;
    } else {
      throw new ExchangeError(`${order.id} malformed order: ${JSON.stringify(order)}`);
    }

    const price = parseFloat(order.price);
    const amount = parseFloat(order.origQty);
    const filled = parseFloat(get(order, 'executedQty', 0.0));
    const remaining = Math.max(amount - filled, 0.0);
    const result = {
      ...this.infoField(order),
      id: order.orderId.toString(),
      timestamp,
      datetime: iso8601(timestamp),
      symbol,
      type: lowerCase(order.type),
      side: lowerCase(order.side),
      price,
      amount,
      cost: price * amount,
      filled,
      remaining,
      status,
      fee: undefined,
    };

    return result;
  };

  parseOrders = (orders, market, since, limit) => {
    const result = Object.values(orders).map(order =>
      this.parseOrder(order, market));

    return this.filterBySinceLimit(result, since, limit);
  };

  commonCurrencyCode = (currency) => {
    if (currency === 'BCC') return 'BCH';
    return currency;
  };

  currencyId = (currency) => {
    if (currency === 'BCH') return 'BCC';
    return currency;
  };

  parseMarkets = (markets) => {
    const result = [];

    markets.forEach((market) => {
      const id = market.symbol;

      if (id === NULL_ID) return;

      const baseId = market.baseAsset;
      const quoteId = market.quoteAsset;
      const base = this.commonCurrencyCode(baseId);
      const quote = this.commonCurrencyCode(quoteId);
      const symbol = `${base}/${quote}`;
      const filters = keyBy(market.filters, 'filterType');
      const precision = {
        base: market.baseAssetPrecision,
        quote: market.quotePrecision,
        amount: market.baseAssetPrecision,
        price: market.quotePrecision,
      };
      const active = market.status === MARKET_STATUS.TRADING;
      const lot = -1 * Math.log10(precision.amount);
      const entry = {
        ...FEES.trading,
        id,
        symbol,
        base,
        quote,
        baseId,
        quoteId,
        ...this.infoField(market),
        lot,
        active,
        precision,
        limits: {
          amount: {
            min: lot,
            max: undefined,
          },
          price: {
            min: -1 * Math.log10(precision.price),
            max: undefined,
          },
          cost: {
            min: lot,
            max: undefined,
          },
        },
      };

      if (filters.PRICE_FILTER) {
        const filter = filters.PRICE_FILTER;

        entry.precision.price = precisionFromString(filter.tickSize);
        entry.limits.price = {
          min: parseFloat(filter.minPrice),
          max: parseFloat(filter.maxPrice),
        };
      }

      if (filters.LOT_SIZE) {
        const filter = filters.LOT_SIZE;

        entry.precision.amount = precisionFromString(filter.stepSize);
        entry.lot = parseFloat(filter.stepSize);
        entry.limits.amount = {
          min: parseFloat(filter.minQty),
          max: parseFloat(filter.maxQty),
        };
      }

      if (filters.MIN_NOTIONAL) {
        entry.limits.cost.min = parseFloat(filters.MIN_NOTIONAL.minNotional);
      }

      result.push(entry);
    });

    return result;
  };

  parseTrade = (trade, market) => {
    const timestamp = trade.T || trade.time || trade.timestamp;
    const price = parseFloat(trade.p || trade.price);
    const amount = parseFloat(trade.q || trade.qty);
    const id = trade.a || trade.id || trade.aggId;
    let side;
    let order;
    let fee;

    if (trade.orderId) {
      order = trade.orderId.toString();
    }

    if (trade.m) {
      side = trade.m ? ORDER_TYPE.SELL : ORDER_TYPE.BUY; // this is reversed intentionally
    } else {
      side = trade.isBuyer ? ORDER_TYPE.BUY : ORDER_TYPE.SELL; // this is a true side
    }

    if (trade.commission) {
      fee = {
        cost: parseFloat(trade.commission),
        currency: this.commonCurrencyCode(trade.commissionAsset),
      };
    }

    return {
      ...this.infoField(trade),
      timestamp,
      datetime: iso8601(timestamp),
      symbol: market.symbol,
      id,
      order,
      type: undefined,
      side,
      price,
      cost: price * amount,
      amount,
      fee,
    };
  };

  parserBalances(response) {
    const result = {
      ...this.infoField(response),
    };

    const { balances } = response;

    balances.forEach((balance) => {
      const { asset } = balance;
      const currency = this.commonCurrencyCode(asset);
      const account = {
        free: parseFloat(balance.free),
        used: parseFloat(balance.locked),
        total: 0.0,
      };
      account.total = sum([account.free, account.used]);
      result[currency] = account;
    });

    return this.parseBalance(result);
  }
}

export default BinanceParser;
