import crypto from 'crypto';
import get from 'lodash/get';
import sum from 'lodash/sum';
import qs from 'qs';

import Exchange from '../base/Exchange';
import ExchangeError from '../base/errors/ExchangeError';

import { milliseconds } from '../../utils/time';
import {
  requiredConfig,
  urls,
  fees,
  api,
  signedApis,
  TAKER,
  ORDER_TYPE,
  TIME_IN_FORCE,
} from './constants';
import {
  parseTicker,
  parseTickers,
  parseOHLCV,
  parseOrder,
  parseOrders,
  parseMarkets,
  parseTrades,
  currencyId,
} from './parsers';
import { parseBalance, parseOrderBook } from '../base/parsers';

class Binance extends Exchange {
  static requiredConfig = requiredConfig;
  static urls = urls;
  static fees = fees;
  static api = api;
  static signedApis = signedApis;

  getHeaders(signed) {
    if (!signed) return {};

    return {
      'X-MBX-APIKEY': this.apiKey,
    };
  }

  getSignature({ params, timestamp }) {
    const strForSign = qs.stringify({
      ...params,
      timestamp,
    });
    const signatureResult = crypto
      .createHmac('sha256', this.apiSecret)
      .update(strForSign)
      .digest('hex');

    return signatureResult;
  }

  sign({
    path, params, timestamp, signed,
  }) {
    return {
      params: {
        ...params,
        timestamp,
        signature: this.getSignature({
          path,
          params,
          timestamp,
        }),
      },
      headers: this.getHeaders(signed),
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

    return parseMarkets(markets, this.constructor.fees);
  }

  calculateFee(symbol, type, side, amount, price, takerOrMaker = TAKER) {
    let key = 'quote';
    const market = this.markets[symbol];
    const rate = market[takerOrMaker];

    let cost = parseFloat(this.costToPrecision(symbol, amount * rate));

    if (side === ORDER_TYPE.SELL) {
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
    const result = {
      info: response,
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

    return parseBalance(balances, this.orders, result);
  }

  async fetchOrderBook(symbol, params = {}) {
    await this.loadMarkets();

    const market = this.market(symbol);
    const orderbook = await this.api.public.get.depth({
      symbol: market.id,
      limit: 100, // default = maximum = 100
      ...params,
    });

    return parseOrderBook(orderbook);
  }

  async fetchTicker(symbol, params = {}) {
    await this.loadMarkets();

    const market = this.market(symbol);
    const response = await this.api.public.get.ticker24Hr({
      symbol: market.id,
      ...params,
    });

    return parseTicker(response, market, this.marketsById);
  }

  async fetchBidAsks(symbols, params = {}) {
    await this.loadMarkets();
    const rawTickers = await this.api.public.get.tickerBookTicker(params);

    return parseTickers(rawTickers, symbols);
  }

  async fetchTickers(symbols, params = {}) {
    await this.loadMarkets();
    const rawTickers = await this.api.public.get.ticker24Hr(params);

    return parseTickers(rawTickers, symbols);
  }

  parseOHLCV = parseOHLCV;

  async fetchOHLCV(symbol, timeframe = '1m', since, limit, params = {}) {
    await this.loadMarkets();

    const market = this.market(symbol);
    const request = {
      symbol: market.id,
      interval: this.timeframes[timeframe],
    };

    request.limit = limit || 500; // default == max == 500

    if (since) {
      request.startTime = since;
    }

    const response = await this.api.public.get.klines({
      ...request,
      ...params,
    });

    return this.parseOHLCVs(response, market, timeframe, since, limit);
  }

  async fetchTrades(symbol, since, limit, params = {}) {
    await this.loadMarkets();
    const market = this.market(symbol);
    const request = {
      symbol: market.id,
    };
    if (since) {
      request.startTime = since;
      request.endTime = since + 3600000;
    }

    if (limit) {
      request.limit = limit;
    }
    // 'fromId': 123,    // ID to get aggregate trades from INCLUSIVE.
    // 'startTime': 456, // Timestamp in ms to get aggregate trades from INCLUSIVE.
    // 'endTime': 789,   // Timestamp in ms to get aggregate trades until INCLUSIVE.
    // 'limit': 500,     // default = maximum = 500
    const response = await this.api.public.get.aggTrades({
      ...request,
      ...params,
    });

    return parseTrades(response, market, since, limit);
  }

  async createOrder(symbol, type, side, amount, price, params = {}) {
    await this.loadMarkets();
    const market = this.market(symbol);
    let order = {
      symbol: market.id,
      quantity: this.amountToString(symbol, amount),
      type: type.toUpperCase(),
      side: side.toUpperCase(),
    };
    if (type === ORDER_TYPE.LIMIT) {
      order = {
        ...order,
        price: this.priceToPrecision(symbol, price),
        timeInForce: TIME_IN_FORCE.GTC,
      };
    }

    const response = await this.api.private.post.order({
      ...order,
      ...params,
    });

    return parseOrder(response, this.marketsById);
  }

  async fetchOrder(id, symbol, params = {}) {
    if (!symbol) {
      throw new ExchangeError('Binance fetchOrder requires a symbol param');
    }

    await this.loadMarkets();

    const market = this.market(symbol);
    const response = await this.api.private.get.order({
      symbol: market.id,
      orderId: parseInt(id, 10),
      params,
    });

    return parseOrder(response, market);
  }

  async fetchOrders(symbol, since, limit, params = {}) {
    if (!symbol) {
      throw new ExchangeError('Binance fetchOrders requires a symbol param');
    }

    await this.loadMarkets();

    const market = this.market(symbol);
    const request = {
      symbol: market.id,
    };

    if (limit) {
      request.limit = limit;
    }

    const response = await this.api.private.get.allOrders({
      ...request,
      ...params,
    });

    return parseOrders(response, market, since, limit);
  }

  async fetchOpenOrders(symbol, since, limit, params = {}) {
    if (!symbol) {
      throw new ExchangeError('Binance fetchOpenOrders requires a symbol param');
    }

    await this.loadMarkets();

    let market;
    const request = {};

    if (symbol) {
      market = this.market(symbol);
      request.symbol = market.id;
    }

    const response = await this.api.private.get.openOrders(this.extend(request, params));

    return parseOrders(response, market, since, limit);
  }

  async fetchMyTrades(symbol, since, limit, params = {}) {
    if (!symbol) {
      throw new ExchangeError('Binance fetchMyTrades requires a symbol argument');
    }

    await this.loadMarkets();

    const market = this.market(symbol);
    const request = {
      symbol: market.id,
    };

    if (limit) {
      request.limit = limit;
    }

    const response = await this.api.private.get.myTrades({
      ...request,
      ...params,
    });

    return parseTrades(response, market, since, limit);
  }

  async withdraw(currency, amount, address, tag, params = {}) {
    const name = address.slice(0, 20);
    const request = {
      asset: this.currencyId(currency),
      address,
      amount: parseFloat(amount),
      name,
    };

    if (tag) {
      request.addressTag = tag;
    }

    const response = await this.api.wapi.post.withdraw({
      ...request,
      ...params,
    });

    return {
      info: response,
      id: get(response, 'id'),
    };
  }

  async fetchDepositAddress(currency, params = {}) {
    const response = await this.api.wapi.get.depositAddress({
      asset: currencyId(currency),
      ...params,
    });

    if (response.success) {
      const address = get(response, 'address');
      const tag = get(response, 'addressTag');

      return {
        currency,
        address,
        tag,
        status: 'ok',
        info: response,
      };
    }

    throw new ExchangeError(`Binance fetchDepositAddress failed: ${this.last_http_response}`);
  }
}

export default Binance;
