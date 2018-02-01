import crypto from 'crypto';
import keyBy from 'lodash/keyBy';
import sum from 'lodash/sum';
import qs from 'qs';

import Exchange from './base/Exchange';
import { precisionFromString } from '../utils/number';
import { milliseconds } from '../utils/time';

class Binance extends Exchange {
  getHeaders() {
    return {
      'X-MBX-APIKEY': this.apiKey,
    };
  }

  getSignature(path, params, timestamp) {
    const strForSign = qs.stringify({ ...params, timestamp });
    const signatureResult = crypto
      .createHmac('sha256', this.apiSecret)
      .update(strForSign)
      .digest('hex');

    return signatureResult;
  }

  sign(options, path, params, timestamp) {
    return {
      params: {
        ...params,
        timestamp,
        signature: this.getSignature(path, params, timestamp),
      },
      headers: {
        'X-MBX-APIKEY': this.apiKey,
      },
    };
  }

  async loadTimeDifference() {
    const before = milliseconds();
    const response = await this.api.public.get.time();
    const after = milliseconds();

    const sumOfDiff = before + after;
    const averageOfDiff = sumOfDiff / 2;

    this.timeDifference = averageOfDiff - response.serverTime;

    return this.timeDifference;
  }

  async fetchMarkets() {
    const response = await this.api.public.get.exchangeInfo();

    if (this.adjustForTimeDifference) {
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
      const filters = keyBy(market.filters, 'filterType');
      const precision = {
        base: market.baseAssetPrecision,
        quote: market.quotePrecision,
        amount: market.baseAssetPrecision,
        price: market.quotePrecision,
      };
      const active = market.status === 'TRADING';
      const lot = -1 * Math.log10(precision.amount);
      const entry = {
        ...this.constructor.fees.trading,
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
  }

  calculateFee(symbol, type, side, amount, price, takerOrMaker = 'taker') {
    let key = 'quote';
    const market = this.markets[symbol];
    const rate = market[takerOrMaker];

    let cost = parseFloat(this.costToPrecision(symbol, amount * rate));

    if (side === 'sell') {
      cost *= price;
    } else {
      key = 'base';
    }

    return {
      type: takerOrMaker,
      currency: market[key],
      rate,
      cost: parseFloat(this.feeToPrecision(symbol, cost)),
    };
  }

  async fetchBalance(params = {}) {
    await this.loadMarkets();
    const response = await this.api.private.get.account(params);
    const result = { info: response };
    const balances = response.balances;
    for (let i = 0; i < balances.length; i++) {
      const balance = balances[i];
      const asset = balance.asset;
      const currency = this.commonCurrencyCode(asset);
      const account = {
        free: parseFloat(balance.free),
        used: parseFloat(balance.locked),
        total: 0.0,
      };
      account.total = sum([account.free, account.used]);
      result[currency] = account;
    }
    return this.parseBalance(result);
  }
}

Binance.requiredConfig = ['apiKey', 'apiSecret'];
Binance.urls = {
  logo: 'https://user-images.githubusercontent.com/1294454/29604020-d5483cdc-87ee-11e7-94c7-d1a8d9169293.jpg',
  api: {
    web: 'https://www.binance.com',
    wapi: 'https://api.binance.com/wapi/v3',
    public: 'https://api.binance.com/api/v1',
    private: 'https://api.binance.com/api/v3',
    v3: 'https://api.binance.com/api/v3',
    v1: 'https://api.binance.com/api/v1',
  },
  www: 'https://www.binance.com',
  doc: 'https://github.com/binance-exchange/binance-official-api-docs/blob/master/rest-api.md',
  fees: [
    'https://binance.zendesk.com/hc/en-us/articles/115000429332',
    'https://support.binance.com/hc/en-us/articles/115000583311',
  ],
};
Binance.fees = {
  trading: {
    tierBased: false,
    percentage: true,
    taker: 0.001,
    maker: 0.001,
  },
};
Binance.api = {
  web: {
    get: ['/exchange/public/product'],
  },
  wapi: {
    post: ['/withdraw'],
    get: ['/depositHistory', '/withdrawHistory', '/depositAddress'],
  },
  v3: {
    get: ['/ticker/price', '/ticker/bookTicker'],
  },
  public: {
    get: [
      '/exchangeInfo',
      '/ping',
      '/time',
      '/depth',
      '/aggTrades',
      '/klines',
      '/ticker/24hr',
      '/ticker/allPrices',
      '/ticker/allBookTickers',
      '/ticker/price',
      '/ticker/bookTicker',
    ],
  },
  private: {
    get: ['/order', '/openOrders', '/allOrders', '/account', '/myTrades'],
    post: ['/order', '/order/test'],
    delete: ['/order'],
  },
  v1: {
    put: ['/userDataStream'],
    post: ['/userDataStream'],
    delete: ['/userDataStream'],
  },
};

export default Binance;
