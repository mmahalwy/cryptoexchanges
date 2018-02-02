import toInteger from 'lodash/toInteger';

import Exchange from '../base/Exchange';
import { parseBalance, parseOrderBook } from '../base/parsers';
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
import { parseTrades } from './parsers';
import { precisionFromString } from '../../utils/number';
import { iso8601, parse8601 } from '../../utils/time';

class Gdax extends Exchange {
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
        info: market,
      });
    });

    return result;
  }

  async fetchBalance() {
    await this.loadMarkets();

    const balances = await this.api.private.get.accounts();
    const result = { info: balances };

    balances.forEach((balance) => {
      const { currency } = balance;
      const account = {
        free: toInteger(balance.available),
        used: toInteger(balance.hold),
        total: toInteger(balance.balance),
      };

      result[currency] = account;
    });

    return parseBalance(result);
  }

  async fetchOrderBook(symbol, params = {}) {
    await this.loadMarkets();
    const orderbook = await this.api.public.get.productsIdBook({
      id: this.marketId(symbol),
      level: 2, // 1 best bidask, 2 aggregated, 3 full
      ...params,
    });

    return parseOrderBook(orderbook);
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
      info: ticker,
    };
  }

  async fetchMyTrades(
    symbol = undefined,
    since = undefined,
    limit = undefined,
    params = {},
  ) {
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

    return parseTrades(response, market, since, limit, this.marketsById);
  }

  async fetchTrades(symbol, since = undefined, limit = undefined, params = {}) {
    await this.loadMarkets();

    const market = this.market(symbol);
    const response = await this.api.public.get.productsIdTrades({
      id: market.id, // fixes issue #2
      ...params,
    });

    return parseTrades(response, market, since, limit, this.marketsById);
  }
}

export default Gdax;
