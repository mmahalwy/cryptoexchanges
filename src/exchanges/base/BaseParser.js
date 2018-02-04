import omit from 'lodash/omit';
import sortBy from 'lodash/sortBy';
import { iso8601, milliseconds } from '../../utils/time';

class BaseParser {
  constructor({ includeInfo = false } = {}) {
    this.includeInfo = includeInfo;
  }

  infoField = data => (this.includeInfo ? { info: data } : {});

  getCurrencyUsedOnOpenOrders = (orders, currency) =>
    Object.values(orders)
      .filter(order => order.status === 'open')
      .reduce((total, order) => {
        const { symbol } = order;
        const market = this.markets[symbol];
        const amount = order.remaining;
        if (currency === market.base && order.side === 'sell') {
          return total + amount;
        } else if (currency === market.quote && order.side === 'buy') {
          return total + (order.cost || order.price * amount);
        }
        return total;
      }, 0);

  parseBalance = (orders, balance) => {
    const currencies = Object.keys(omit(balance, 'info'));
    const scopedBalance = balance;

    currencies.forEach((currency) => {
      if (typeof balance[currency].used === 'undefined') {
        if (this.parseBalanceFromOpenOrders && 'open_orders' in balance.info) {
          const exchangeOrdersCount = balance.info.open_orders;
          const cachedOrdersCount = Object.values(orders).filter(order => order.status === 'open')
            .length;

          if (cachedOrdersCount === exchangeOrdersCount) {
            scopedBalance[currency].used = this.getCurrencyUsedOnOpenOrders(orders, currency);
            scopedBalance[currency].total =
              scopedBalance[currency].used + scopedBalance[currency].free;
          }
        } else {
          scopedBalance[currency].used = this.getCurrencyUsedOnOpenOrders(orders, currency);
          scopedBalance[currency].total =
            scopedBalance[currency].used + scopedBalance[currency].free;
        }
      }

      ['free', 'used', 'total'].forEach((account) => {
        scopedBalance[account] = scopedBalance[account] || {};
        scopedBalance[account][currency] = scopedBalance[currency][account];
      });
    });

    return scopedBalance;
  };

  parseOHLCV = ohlcv => ohlcv;

  parseOHLCVs = (
    ohlcvs,
    market = undefined,
    timeframe = '1m',
    since = undefined,
    limit = undefined,
  ) => {
    const ohlcvsValues = Object.values(ohlcvs);
    const result = [];

    ohlcvsValues.forEach((ohlcvsValue) => {
      if (limit && result.length >= limit) return null;

      const ohlcv = this.parseOHLCV(ohlcvsValue, market, timeframe, since, limit);

      if (since && ohlcv[0] < since) return null;

      return result.push(ohlcv);
    });

    return result;
  };

  filterBySinceLimit = (array, since = undefined, limit = undefined) => {
    let scopedArray = array;

    if (since) {
      scopedArray = array.filter(entry => entry.timestamp > since);
    }

    if (limit) {
      scopedArray = scopedArray.slice(0, limit);
    }

    return scopedArray;
  };

  parseBidAsk = (bidask, priceKey = 0, amountKey = 1) => {
    const price = parseFloat(bidask[priceKey]);
    const amount = parseFloat(bidask[amountKey]);
    return [price, amount];
  };

  parseBidsAsks = (bidasks, priceKey = 0, amountKey = 1) =>
    Object.values(bidasks || []).map(bidask => this.parseBidAsk(bidask, priceKey, amountKey));

  parseOrderBook = (
    orderbook,
    timestamp = milliseconds(),
    bidsKey = 'bids',
    asksKey = 'asks',
    priceKey = 0,
    amountKey = 1,
  ) => ({
    bids: sortBy(
      bidsKey in orderbook ? this.parseBidsAsks(orderbook[bidsKey], priceKey, amountKey) : [],
      0,
      true,
    ),
    asks: sortBy(
      asksKey in orderbook ? this.parseBidsAsks(orderbook[asksKey], priceKey, amountKey) : [],
      0,
    ),
    timestamp,
    datetime: iso8601(timestamp),
  });

  parseTrades = (trades, market, since, limit, parseTrade) => {
    let result = Object.values(trades).map(trade => parseTrade(trade, market));
    result = sortBy(result, 'timestamp', true);
    return this.filterBySinceLimit(result, since, limit);
  };
}

export default BaseParser;
