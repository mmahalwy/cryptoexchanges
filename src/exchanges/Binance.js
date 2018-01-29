import sortedIndexBy from 'lodash/sortedIndexBy';

import Exchange from './base/Exchange';
import { precisionFromString } from '../utils/number';

const BASE_URL = 'https://api.binance.com';

class Binance extends Exchange {
  getHeaders() {
    return {
      'X-MBX-APIKEY': this.apiKey,
    };
  }

  fetchUserInfo() {
    return this.signedRequest('get', '/user/info');
  }

  async fetchMarkets() {
    const response = await this.request('get', '/exchangeInfo');

    if (this.options.adjustForTimeDifference) {
      await this.loadTimeDifference();
    }

    const markets = response.symbols;
    const result = [];

    markets.forEach((market) => {
      const id = market.symbol;

      if (id === '123456') return;

      const baseId = market.baseAsset;
      const quoteId = market.quoteAsset;
      const base = this.commonCurrencyCode(baseId);
      const quote = this.commonCurrencyCode(quoteId);
      const symbol = `${base}/${quote}`;
      const filters = sortedIndexBy(market.filters, 'filterType');
      const precision = {
        base: market.baseAssetPrecision,
        quote: market.quotePrecision,
        amount: market.baseAssetPrecision,
        price: market.quotePrecision,
      };
      const active = market.status === 'TRADING';
      const lot = -1 * Math.log10(precision.amount);
      const entry = {
        ...this.fees.trading,
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

      if ('PRICE_FILTER' in filters) {
        const filter = filters.PRICE_FILTER;

        entry.precision.price = precisionFromString(filter.tickSize);
        entry.limits.price = {
          min: parseFloat(filter.minPrice),
          max: parseFloat(filter.maxPrice),
        };
      }

      if ('LOT_SIZE' in filters) {
        const filter = filters.LOT_SIZE;

        entry.precision.amount = precisionFromString(filter.stepSize);
        entry.lot = parseFloat(filter.stepSize);
        entry.limits.amount = {
          min: parseFloat(filter.minQty),
          max: parseFloat(filter.maxQty),
        };
      }

      if ('MIN_NOTIONAL' in filters) {
        entry.limits.cost.min = parseFloat(filters.MIN_NOTIONAL.minNotional);
      }

      result.push(entry);
    });

    return result;
  }
}

Binance.baseUrl = BASE_URL;
Binance.requiredConfig = ['apiKey', 'apiSecret'];
Binance.trading = {
  tierBased: false,
  percentage: true,
  taker: 0.001,
  maker: 0.001,
};
Binance.api = {
  web: {
    get: ['exchange/public/product'],
  },
  wapi: {
    post: ['withdraw'],
    get: ['depositHistory', 'withdrawHistory', 'depositAddress'],
  },
  v3: {
    get: ['ticker/price', 'ticker/bookTicker'],
  },
  public: {
    get: [
      'exchangeInfo',
      'ping',
      'time',
      'depth',
      'aggTrades',
      'klines',
      'ticker/24hr',
      'ticker/allPrices',
      'ticker/allBookTickers',
      'ticker/price',
      'ticker/bookTicker',
    ],
  },
  private: {
    get: ['order', 'openOrders', 'allOrders', 'account', 'myTrades'],
    post: ['order', 'order/test'],
    delete: ['order'],
  },
  v1: {
    put: ['userDataStream'],
    post: ['userDataStream'],
    delete: ['userDataStream'],
  },
};

export default Binance;
