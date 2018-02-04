import toInteger from 'lodash/toInteger';
import sum from 'lodash/sum';

import BaseExchange from '../base/BaseExchange';
import {
  REQUIRED_CREDENTIALS,
  URLS,
  FEES,
  API,
  SIGNED_APIS,
  BASE_ASSETS,
  NON_BTC_TAKER,
  MARKET_STATUS,
} from './constants';
import GdaxParser from './GdaxParser';
import { precisionFromString } from '../../utils/number';
import { iso8601, parse8601, ymdhms } from '../../utils/time';

class Gdax extends BaseExchange {
  static Parser = GdaxParser;
  static REQUIRED_CREDENTIALS = REQUIRED_CREDENTIALS;
  static URLS = URLS;
  static FEES = FEES;
  static API = API;
  static SIGNED_APIS = SIGNED_APIS;

  async fetchMarkets() {
    const markets = await this.api.public.get.products();

    const result = [];

    markets.forEach((market) => {
      const { id } = market;
      const base = market.base_currency;
      const quote = market.quote_currency;
      const symbol = `${base}/${quote}`;
      const priceLimits = {
        min: toInteger(market.quote_increment),
        max: undefined,
      };
      const precision = {
        amount: 8,
        price: precisionFromString(market.quote_increment),
      };

      let { taker } = this.constructor.FEES.trading;

      if (base === BASE_ASSETS.ETH || base === BASE_ASSETS.LTC) {
        taker = NON_BTC_TAKER;
      }

      const active = market.status === MARKET_STATUS.ONLINE;

      result.push({
        ...this.constructor.FEES.trading,
        id,
        symbol,
        base,
        quote,
        precision,
        limits: {
          amount: {
            min: market.base_min_size && parseFloat(market.base_min_size),
            max: market.base_max_size && parseFloat(market.base_max_size),
          },
          price: priceLimits,
          cost: {
            min: market.min_market_funds && parseFloat(market.min_market_funds),
            max: market.max_market_funds && parseFloat(market.max_market_funds),
          },
        },
        taker,
        active,
        ...this.parser.infoField(market),
      });
    });

    return result;
  }

  async fetchBalance() {
    await this.loadMarkets();

    const balances = await this.api.private.get.accounts();
    const result = { ...this.parser.infoField(balances) };

    balances.forEach((balance) => {
      const { currency } = balance;
      const account = {
        free: toInteger(balance.available),
        used: toInteger(balance.hold),
        total: toInteger(balance.balance),
      };

      result[currency] = account;
    });

    return this.parsers.parseBalance(result);
  }

  async fetchOrderBook(symbol, params = {}) {
    await this.loadMarkets();
    const orderbook = await this.api.public.get.productsIdBook({
      id: this.marketId(symbol),
      level: 2, // 1 best bidask, 2 aggregated, 3 full
      ...params,
    });

    return this.parsers.parseOrderBook(orderbook);
  }

  async fetchTicker(symbol, params = {}) {
    await this.loadMarkets();

    const market = this.market(symbol);
    const request = this.extend(
      {
        id: market.id,
      },
      params,
    );

    const ticker = await this.api.public.get.productsIdTicker(request);
    const timestamp = parse8601(ticker.time);
    const bid = ticker.bid ? toInteger(ticker.bid) : null;
    const ask = ticker.ask ? toInteger(ticker.ask) : null;

    return {
      symbol,
      timestamp,
      datetime: iso8601(timestamp),
      high: undefined,
      low: undefined,
      bid,
      ask,
      vwap: undefined,
      open: undefined,
      close: undefined,
      first: undefined,
      last: toInteger(ticker.price),
      change: undefined,
      percentage: undefined,
      average: undefined,
      baseVolume: toInteger(ticker.volume),
      quoteVolume: undefined,
      ...this.parser.infoField(ticker),
    };
  }

  async fetchMyTrades(symbol, since, limit, params = {}) {
    await this.loadMarkets();

    let market;
    const request = {};

    if (symbol) {
      market = this.market(symbol);
      request.product_id = market.id;
    }

    if (limit) {
      request.limit = limit;
    }

    const response = await this.api.private.get.fills({
      ...request,
      ...params,
    });

    return this.parsers.parseTrades(response, market, since, limit, this.marketsById);
  }

  async fetchTrades(symbol, since, limit, params = {}) {
    await this.loadMarkets();

    const market = this.market(symbol);
    const response = await this.api.public.get.productsIdTrades({
      id: market.id, // fixes issue #2
      ...params,
    });

    return this.parsers.parseTrades(response, market, since, limit, this.marketsById);
  }

  async fetchOHLCV(symbol, timeframe = '1m', since, limit, params = {}) {
    await this.loadMarkets();
    const market = this.market(symbol);
    const granularity = this.timeframes[timeframe];
    const request = {
      id: market.id,
      granularity,
    };
    if (typeof since !== 'undefined') {
      request.start = ymdhms(since);
      if (typeof limit === 'undefined') {
        // https://docs.gdax.com/#get-historic-rates
        limit = 350; // max = 350
      }

      request.end = ymdhms(sum([limit * granularity * 1000, since]));
    }
    const response = await this.api.public.get.productsIdCandles({ ...request, ...params });

    return this.parsers.parseOHLCVs(response, market, timeframe, since, limit);
  }

  async fetchTime() {
    const response = await this.api.public.get.time();

    return parse8601(response.iso);
  }

  async fetchOrder(id, symbol, params = {}) {
    await this.loadMarkets();

    const response = await this.api.private.get.ordersId({
      id,
      ...params,
    });

    return this.parsers.parseOrder(response);
  }

  async fetchOrders(symbol, since, limit, params = {}) {
    await this.loadMarkets();
    const request = {
      status: 'all',
    };
    let market;
    if (symbol) {
      market = this.market(symbol);
      request.product_id = market.id;
    }
    const response = await this.api.private.get.orders({ ...request, ...params });
    return this.parsers.parseOrders(response, market, since, limit);
  }
}

export default Gdax;
