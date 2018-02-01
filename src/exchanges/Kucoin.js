import crypto from 'crypto';
import sum from 'lodash/sum';

import Exchange from './base/Exchange';
import ExchangeError from './base/errors/ExchangeError';
import { ORDER_TYPES, ORDER_SIDES } from '../constants';

class Kucoin extends Exchange {
  getSignature(path, queryString, nonce) {
    const strForSign = `${path}/${nonce}/${queryString}`;
    const signatureStr = Buffer.from(strForSign).toString('base64');
    const signatureResult = crypto
      .createHmac('sha256', this.apiSecret)
      .update(signatureStr)
      .digest('hex');

    return signatureResult;
  }

  sign(options, path, queryString, nonce) {
    return {
      headers: {
        'KC-API-KEY': this.apiKey,
        'KC-API-NONCE': nonce,
        'KC-API-SIGNATURE': this.getSignature(path, queryString, nonce),
      },
    };
  }

  fetchUserInfo() {
    return this.signedRequest('get', '/user/info');
  }

  async fetchMarkets() {
    const response = await this.api.public.get.marketOpenSymbols();
    const markets = response.data;

    return markets.map((market) => {
      const id = market.symbol;
      let base = market.coinType;
      let quote = market.coinTypePair;

      base = this.commonCurrencyCode(base);
      quote = this.commonCurrencyCode(quote);

      const symbol = `${base}/${quote}`;

      const precision = {
        amount: 8,
        price: 8,
      };
      const active = market.trading;

      return {
        ...this.constructor.fees.trading,
        id,
        symbol,
        base,
        quote,
        active,
        info: market,
        lot: 10 ** -precision.amount,
        precision,
        limits: {
          amount: {
            min: 10 ** -precision.amount,
            max: undefined,
          },
          price: {
            min: undefined,
            max: undefined,
          },
        },
      };
    });
  }

  async fetchCurrencies(params = {}) {
    const { data: currencies } = await this.api.public.get.marketOpenCoins(params);
    const result = {};

    currencies.forEach((currency) => {
      const id = currency.coin;
      const code = this.commonCurrencyCode(id);
      const precision = currency.tradePrecision;
      const deposit = currency.enableDeposit;
      const withdraw = currency.enableWithdraw;
      const active = deposit && withdraw;

      result[code] = {
        id,
        code,
        info: currency,
        name: currency.name,
        active,
        status: 'ok',
        fee: currency.withdrawFeeRate, // todo: redesign
        precision,
        limits: {
          amount: {
            min: 10 ** -precision,
            max: 10 ** precision,
          },
          price: {
            min: 10 ** -precision,
            max: 10 ** precision,
          },
          cost: {
            min: undefined,
            max: undefined,
          },
          withdraw: {
            min: currency.withdrawMinAmount,
            max: 10 ** precision,
          },
        },
      };
    });

    return result;
  }

  // TODO: use symbols
  // eslint-disable-next-line no-unused-vars
  async fetchTickers(symbols = undefined, params = {}) {
    const response = await this.api.public.get.marketOpenSymbols(params);
    const tickers = response.data;
    const result = {};

    tickers.forEach((ticker) => {
      const parsed = this.parseTicker(ticker);
      const { symbol } = parsed;
      result[symbol] = ticker;
    });

    return result;
  }

  async fetchTicker(symbol, params = {}) {
    await this.loadMarkets();

    const market = this.market(symbol);
    const response = await this.api.public.get.openTick({
      symbol: market.id,
      ...params,
    });

    const ticker = response.data;

    return this.parseTicker(ticker, market);
  }

  parseTrade(trade, market = undefined) {
    const timestamp = trade[0];
    let side;

    if (trade[1] === ORDER_SIDES.BUY) {
      side = 'buy';
    } else if (trade[1] === ORDER_SIDES.SELL) {
      side = 'sell';
    }

    return {
      id: undefined,
      info: trade,
      timestamp,
      datetime: this.iso8601(timestamp),
      symbol: market.symbol,
      type: ORDER_TYPES.LIMIT,
      side,
      price: trade[2],
      amount: trade[3],
    };
  }

  async fetchTrades(symbol, since = undefined, limit = undefined, params = {}) {
    await this.loadMarkets();

    const market = this.market(symbol);
    const response = await this.api.public.get.openDealOrders({
      symbol: market.id,
      ...params,
    });

    return this.parseTrades(response.data, market, since, limit);
  }

  async fetchBalance(params = {}) {
    await this.loadMarkets();

    const { data: balances } = await this.api.private.get.accountBalance({
      limit: 20, // default 12, max 20
      page: 1,
      ...params,
    });

    const result = { info: balances };
    const indexed = this.indexBy(balances, 'coinType');
    const keys = Object.keys(indexed);

    keys.forEach((id) => {
      const currency = this.commonCurrencyCode(id);
      const account = {};
      const balance = indexed[id];
      const used = parseFloat(balance.freezeBalance);
      const free = parseFloat(balance.balance);
      const total = sum([free, used]);

      account.free = free;
      account.used = used;
      account.total = total;
      result[currency] = account;
    });

    return this.parseBalance(result);
  }

  async createOrder(
    symbol,
    type,
    side,
    amount,
    price = undefined,
    params = {},
  ) {
    if (type !== ORDER_TYPES.LIMIT) {
      throw new ExchangeError(`${this.id} allows limit orders only`);
    }

    await this.loadMarkets();

    const market = this.market(symbol);
    const { base } = market;
    const order = {
      symbol: market.id,
      type: side.toUpperCase(),
      price: this.priceToPrecision(symbol, price),
      amount: this.truncate(amount, this.currencies[base].precision),
    };

    const response = await this.api.private.postOrder({ ...order, ...params });

    return {
      info: response,
      id: this.safeString(response.data, 'orderOid'),
    };
  }

  async cancelOrder(id, symbol = undefined, params = {}) {
    if (!symbol) {
      throw new ExchangeError(`${this.id} cancelOrder requires symbol argument`);
    }

    await this.loadMarkets();

    const market = this.market(symbol);
    const request = {
      symbol: market.id,
      orderOid: id,
    };

    if ('type' in params) {
      request.type = params.type.toUpperCase();
    } else {
      throw new ExchangeError(`${this.id} cancelOrder requires type (BUY or SELL) param`);
    }

    const response = await this.api.private.postCancelOrder({
      ...request,
      ...params,
    });

    return response;
  }

  async fetchOpenOrders(
    symbol = undefined,
    since = undefined,
    limit = undefined,
    params = {},
  ) {
    if (!symbol) {
      throw new ExchangeError(`${this.id} fetchOpenOrders requires a symbol param`);
    }

    await this.loadMarkets();

    const market = this.market(symbol);
    const request = {
      symbol: market.id,
    };

    const response = await this.api.private.get.orderActiveMap({
      ...request,
      ...params,
    });
    const orders = this.arrayConcat(response.data.SELL, response.data.BUY);
    const result = [];

    orders.forEach((order) => {
      result.push({ ...order, status: 'open' });
    });

    return this.parseOrders(result, market, since, limit);
  }

  async fetchClosedOrders(
    symbol = undefined,
    since = undefined,
    limit = undefined,
    params = {},
  ) {
    const request = {};

    await this.loadMarkets();

    let market;

    if (typeof symbol !== 'undefined') {
      market = this.market(symbol);
      request.symbol = market.id;
    }

    if (typeof since !== 'undefined') request.since = since;
    if (typeof limit !== 'undefined') request.limit = limit;

    const response = await this.api.private.get.orderDealt({
      ...request,
      ...params,
    });
    const orders = response.data.datas;
    const result = [];

    orders.forEach((order) => {
      result.push({ ...order, status: 'closed' });
    });

    return this.parseOrders(result, market, since, limit);
  }

  parseTradingViewOHLCVs(
    ohlcvs,
    market = undefined,
    timeframe = '1m',
    since = undefined,
    limit = undefined,
  ) {
    const result = [];
    for (let i = 0; i < ohlcvs.t.length; i += 1) {
      result.push([
        ohlcvs.t[i] * 1000,
        ohlcvs.o[i],
        ohlcvs.h[i],
        ohlcvs.l[i],
        ohlcvs.c[i],
        ohlcvs.v[i],
      ]);
    }
    return this.parseOHLCVs(result, market, timeframe, since, limit);
  }

  async fetchOHLCV(
    symbol,
    timeframe = '1m',
    since = undefined,
    limit = undefined,
    params = {},
  ) {
    await this.loadMarkets();

    const market = this.market(symbol);
    let changedLimit = limit;
    let end = this.seconds();
    let resolution = this.timeframes[timeframe];
    // convert 'resolution' to minutes in order to calculate 'from' later
    let minutes = resolution;

    if (minutes === 'D') {
      if (typeof limit === 'undefined') changedLimit = 30; // 30 days, 1 month
      minutes = 1440;
    } else if (minutes === 'W') {
      if (typeof changedLimit === 'undefined') changedLimit = 52; // 52 weeks, 1 year
      minutes = 10080;
    } else if (typeof changedLimit === 'undefined') {
      changedLimit = 1440;
      minutes = 1440;
      resolution = 'D';
    }

    let start = end - (minutes * 60 * changedLimit);
    if (typeof since !== 'undefined') {
      start = parseInt(since / 1000, 10);
      end = this.sum(start, minutes * 60 * changedLimit);
    }

    const request = {
      symbol: market.id,
      type: this.timeframes[timeframe],
      resolution,
      from: start,
      to: end,
    };

    const response = await this.api.kitchen.get.openChartHistory({
      ...request,
      ...params,
    });

    return this.parseTradingViewOHLCVs(
      response,
      market,
      timeframe,
      since,
      changedLimit,
    );
  }
}

Kucoin.requiredConfig = ['apiKey', 'apiSecret'];
Kucoin.urls = {
  logo: 'https://user-images.githubusercontent.com/1294454/33795655-b3c46e48-dcf6-11e7-8abe-dc4588ba7901.jpg',
  api: {
    public: 'https://api.kucoin.com/v1',
    private: 'https://api.kucoin.com/v1',
    kitchen: 'https://kitchen.kucoin.com',
  },
  www: 'https://kucoin.com',
  doc: 'https://kucoinapidocs.docs.apiary.io',
  fees: 'https://news.kucoin.com/en/fee',
};
Kucoin.fees = {
  trading: {
    maker: 0.0010,
    taker: 0.0010,
  },
};
Kucoin.api = {
  kitchen: {
    get: ['/open/chart/history'],
  },
  public: {
    get: [
      '/open/chart/config',
      '/open/chart/history',
      '/open/chart/symbol',
      '/open/currencies',
      '/open/deal-orders',
      '/open/kline',
      '/open/lang-list',
      '/open/orders',
      '/open/orders-buy',
      '/open/orders-sell',
      '/open/tick',
      '/market/open/coin-info',
      '/market/open/coins',
      '/market/open/coins-trending',
      '/market/open/symbols',
    ],
  },
  private: {
    get: [
      '/account/balance',
      '/account/{coin}/wallet/address',
      '/account/{coin}/wallet/records',
      '/account/{coin}/balance',
      '/account/promotion/info',
      '/account/promotion/sum',
      '/deal-orders',
      '/order/active',
      '/order/active-map',
      '/order/dealt',
      '/referrer/descendant/count',
      '/user/info',
    ],
    post: [
      '/account/{coin}/withdraw/apply',
      '/account/{coin}/withdraw/cancel',
      '/cancel-order',
      '/order',
      '/user/change-lang',
    ],
  },
};
Kucoin.signedApis = ['private'];

export default Kucoin;
