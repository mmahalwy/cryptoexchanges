import keyBy from 'lodash/keyBy';
import get from 'lodash/get';
import toInteger from 'lodash/toInteger';

import ExchangeError from '../base/errors/ExchangeError';
import BaseParser from '../base/BaseParser';
import { iso8601, milliseconds } from '../../utils/time';
import { precisionFromString } from '../../utils/number';
import { NULL_ID, ORDER_TYPE, MARKET_STATUS, ORDER_STATUS, FEES } from './constants';

class BinanceParser extends BaseParser {
  parseTicker = (ticker, market = undefined, marketsById) => {
    let symbol;
    let scopedMarket = market;
    let timestamp = toInteger(ticker.closeTime);

    if (!timestamp) {
      timestamp = milliseconds();
    }

    // eslint-disable-next-line prefer-destructuring
    symbol = ticker.symbol;

    if (!market) {
      if (marketsById[symbol]) {
        scopedMarket = marketsById[symbol];
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
      high: toInteger(ticker.highPrice),
      low: toInteger(ticker.lowPrice),
      bid: toInteger(ticker.bidPrice),
      bidVolume: toInteger(ticker.bidQty),
      ask: toInteger(ticker.askPrice),
      askVolume: toInteger(ticker.askQty),
      vwap: toInteger(ticker.weightedAvgPrice),
      open: toInteger(ticker.openPrice),
      close: toInteger(ticker.prevClosePrice),
      first: undefined,
      last: toInteger(ticker.lastPrice),
      change: toInteger(ticker.priceChangePercent),
      percentage: undefined,
      average: undefined,
      baseVolume: toInteger(ticker.volume),
      quoteVolume: toInteger(ticker.quoteVolume),
      info: ticker,
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
      if (symbol in tickersBySymbol) {
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
    if (status === ORDER_STATUS.NEW) return 'open';
    if (status === ORDER_STATUS.PARTIALLY_FILLED) return 'open';
    if (status === ORDER_STATUS.FILLED) return 'closed';
    if (status === ORDER_STATUS.CANCELED) return 'canceled';

    return status.toLowerCase();
  };

  parseOrder = (order, market, marketsById) => {
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
      if (id in marketsById) {
        // eslint-disable-next-line prefer-destructuring
        scopedMarket = marketsById[id];
        // eslint-disable-next-line prefer-destructuring
        symbol = scopedMarket.symbol;
      }
    }

    if ('time' in order) {
      timestamp = order.time;
    } else if ('transactTime' in order) {
      timestamp = order.transactTime;
    } else {
      throw new ExchangeError(`${order.id} malformed order: ${JSON.stringify(order)}`);
    }

    const price = parseFloat(order.price);
    const amount = parseFloat(order.origQty);
    const filled = this.safeFloat(order, 'executedQty', 0.0);
    const remaining = Math.max(amount - filled, 0.0);
    const result = {
      info: order,
      id: order.orderId.toString(),
      timestamp,
      datetime: this.iso8601(timestamp),
      symbol,
      type: order.type.toLowerCase(),
      side: order.side.toLowerCase(),
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
    const result = Object.values(orders).map(order => this.parseOrder(order, market));

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
        info: market,
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
    const timestampField = 'T' in trade ? 'T' : 'time';
    const timestamp = trade[timestampField];
    const priceField = 'p' in trade ? 'p' : 'price';
    const price = parseFloat(trade[priceField]);
    const amountField = 'q' in trade ? 'q' : 'qty';
    const amount = parseFloat(trade[amountField]);
    const idField = 'a' in trade ? 'a' : 'id';
    const id = trade[idField].toString();
    let side;
    let order;
    let fee;

    if ('orderId' in trade) {
      order = trade.orderId.toString();
    }

    if ('m' in trade) {
      side = trade.m ? ORDER_TYPE.SELL : ORDER_TYPE.BUY; // this is reversed intentionally
    } else {
      side = trade.isBuyer ? ORDER_TYPE.BUY : ORDER_TYPE.SELL; // this is a true side
    }

    if ('commission' in trade) {
      fee = {
        cost: parseFloat(trade.commission),
        currency: this.commonCurrencyCode(trade.commissionAsset),
      };
    }

    return {
      info: trade,
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
}

export default BinanceParser;
