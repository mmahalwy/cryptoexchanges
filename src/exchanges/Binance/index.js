import crypto from 'crypto';
import get from 'lodash/get';
import upperCase from 'lodash/upperCase';
import qs from 'qs';

import BaseExchange from '../base/BaseExchange';
import ExchangeError from '../base/errors/ExchangeError';
import { ORDER_TYPES } from '../../constants';
import { validateRequiredParams } from '../../utils/validations';
import { milliseconds } from '../../utils/time';
import {
  REQUIRED_CREDENTIALS,
  URLS,
  FEES,
  API,
  SIGNED_APIS,
  TIMEFRAMES,
  TAKER,
  TIME_IN_FORCE,
  DEFAULT_OHLCV_LIMIT,
} from './constants';
import BinanceParser from './BinanceParser';

class Binance extends BaseExchange {
  static Parser = BinanceParser;
  static REQUIRED_CREDENTIALS = REQUIRED_CREDENTIALS;
  static URLS = URLS;
  static FEES = FEES;
  static API = API;
  static SIGNED_APIS = SIGNED_APIS;

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

  sign({ path, params }) {
    const nonce = new Date().getTime();

    if (this.verbose) {
      console.log(`Signing with nonce: ${nonce}, path: ${path}, params: ${params}`);
    }

    return {
      params: {
        ...params,
        timestamp: nonce,
        signature: this.getSignature({
          path,
          params,
          timestamp: nonce,
        }),
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

    return this.parser.parseMarkets(markets);
  }

  calculateFee({
    symbol, side, amount, price, takerOrMaker = TAKER,
  } = {}) {
    let key = 'quote';
    const market = this.markets[symbol];
    const rate = market[takerOrMaker];

    let cost = parseFloat(this.costToPrecision(symbol, amount * rate));

    if (side === ORDER_TYPES.LOWER.SELL) {
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

  async fetchBalance({ params = {} } = {}) {
    await this.loadMarkets();

    const response = await this.api.private.get.account({ params });

    return this.parser.parserBalances(response);
  }

  async fetchOrderBook({ symbol, params = {} } = {}) {
    await this.loadMarkets();

    const market = this.market(symbol);
    const orderbook = await this.api.public.get.depth({
      params: {
        symbol: market.id,
        limit: 100, // default = maximum = 100
        ...params,
      },
    });

    return this.parser.parseOrderBook(orderbook);
  }

  async fetchTicker({ symbol, params = {} } = {}) {
    validateRequiredParams({ name: 'fetchTicker', params: { symbol } });

    await this.loadMarkets();

    const market = this.market(symbol);
    const response = await this.api.public.get.ticker24Hr({
      params: {
        symbol: market.id,
        ...params,
      },
    });

    return this.parser.parseTicker(response, market, this.marketsById);
  }

  async fetchBidAsks({ symbols, params = {} } = {}) {
    await this.loadMarkets();
    const rawTickers = await this.api.public.get.tickerBookTicker({ params });

    return this.parser.parseTickers(rawTickers, symbols);
  }

  async fetchTickers({ symbols, params = {} } = {}) {
    await this.loadMarkets();
    const rawTickers = await this.api.public.get.ticker24Hr({ params });

    return this.parser.parseTickers(rawTickers, symbols);
  }

  async fetchOHLCV({
    symbol, timeframe = TIMEFRAMES['1m'], since, limit, params = {},
  } = {}) {
    await this.loadMarkets();

    const market = this.market(symbol);
    const setupParams = {
      symbol: market.id,
      interval: TIMEFRAMES[timeframe],
    };

    setupParams.limit = limit || DEFAULT_OHLCV_LIMIT; // default == max == 500

    if (since) {
      setupParams.startTime = since;
    }

    const response = await this.api.public.get.klines({
      params: { ...setupParams, ...params },
    });

    return this.parser.parseOHLCVs(response, market, timeframe, since, limit);
  }

  async fetchTrades({
    symbol, since, limit, params = {},
  } = {}) {
    validateRequiredParams({
      name: 'fetchTrades',
      params: { symbol },
      error: ExchangeError,
    });

    await this.loadMarkets();
    const market = this.market(symbol);
    const setupParams = {
      symbol: market.id,
    };

    if (since) {
      setupParams.startTime = since;
      setupParams.endTime = since + 3600000;
    }

    if (limit) {
      setupParams.limit = limit;
    }
    // 'fromId': 123,    // ID to get aggregate trades from INCLUSIVE.
    // 'startTime': 456, // Timestamp in ms to get aggregate trades from INCLUSIVE.
    // 'endTime': 789,   // Timestamp in ms to get aggregate trades until INCLUSIVE.
    // 'limit': 500,     // default = maximum = 500
    const response = await this.api.public.get.aggTrades({
      symbol: market.id,
      params: {
        ...setupParams,
        ...params,
      },
    });

    return this.parser.parseTrades(response, market, since, limit);
  }

  async createOrder({
    symbol, type, side, amount, price, params = {},
  } = {}) {
    await this.loadMarkets();
    const market = this.market(symbol);

    const order = {
      symbol: market.id,
      quantity: this.amountToString(symbol, amount),
      type: upperCase(type),
      side: upperCase(side),
    };

    if (type === ORDER_TYPES.LOWER.LIMIT) {
      order.price = this.priceToPrecision(symbol, price);
      order.timeInForce = TIME_IN_FORCE.GTC;
    }

    const response = await this.api.private.post.order({
      data: {
        ...order,
        ...params,
      },
    });

    return this.parser.parseOrder(response, this.marketsById);
  }

  async fetchOrder({ id, symbol, params = {} } = {}) {
    validateRequiredParams({
      name: 'fetchOrder',
      params: { symbol, id },
      error: ExchangeError,
    });

    await this.loadMarkets();

    const market = this.market(symbol);
    const response = await this.api.private.get.order({
      params: {
        symbol: market.id,
        orderId: parseInt(id, 10),
        ...params,
      },
    });

    return this.parser.parseOrder(response, market);
  }

  async fetchOrders({
    symbol, since, limit, params = {},
  } = {}) {
    validateRequiredParams({
      name: 'fetchOrders',
      params: { symbol },
      error: ExchangeError,
    });

    await this.loadMarkets();

    const market = this.market(symbol);

    const response = await this.api.private.get.allOrders({
      symbol: market.id,
      params: {
        limit,
        ...params,
      },
    });

    return this.parser.parseOrders(response, market, since, limit);
  }

  async fetchOpenOrders({
    symbol, since, limit, params = {},
  } = {}) {
    validateRequiredParams({
      name: 'fetchOpenOrders',
      params: { symbol },
      error: ExchangeError,
    });

    await this.loadMarkets();

    let market;
    const setupParams = {};

    if (symbol) {
      market = this.market(symbol);
      setupParams.symbol = market.id;
    }

    const response = await this.api.private.get.openOrders({
      ...setupParams,
      params,
    });

    return this.parser.parseOrders(response, market, since, limit);
  }

  async fetchMyTrades({
    symbol, since, limit, params = {},
  } = {}) {
    validateRequiredParams({
      name: 'fetchMyTrades',
      params: { symbol },
      error: ExchangeError,
    });

    await this.loadMarkets();

    const market = this.market(symbol);

    const response = await this.api.private.get.myTrades({
      params: {
        symbol: market.id,
        limit,
        ...params,
      },
    });

    return this.parser.parseTrades(response, market, since, limit);
  }

  async withdraw({
    currency, amount, address, tag, params = {},
  } = {}) {
    validateRequiredParams({
      name: 'fetchMyTrades',
      params: { address, amount, currency },
      error: ExchangeError,
    });

    const name = address.slice(0, 20);
    const request = {
      asset: this.parser.currencyId(currency),
      address,
      amount: parseFloat(amount),
      name,
    };

    if (tag) {
      request.addressTag = tag;
    }

    const response = await this.api.wapi.post.withdraw({
      data: {
        ...request,
        ...params,
      },
    });

    return {
      ...this.parser.infoField(response),
      id: get(response, 'id'),
    };
  }

  async fetchDepositAddress({ currency, params = {} } = {}) {
    const response = await this.api.wapi.get.depositAddress({
      asset: this.parser.currencyId(currency),
      params,
    });

    if (response.success) {
      const address = get(response, 'address');
      const tag = get(response, 'addressTag');

      return {
        currency,
        address,
        tag,
        status: 'ok',
        ...this.parser.infoField(response),
      };
    }

    throw new ExchangeError(`Binance fetchDepositAddress failed: ${this.last_http_response}`);
  }
}

export default Binance;
