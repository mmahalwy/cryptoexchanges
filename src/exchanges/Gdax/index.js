import crypto from 'crypto';
import sum from 'lodash/sum';
import get from 'lodash/get';
import upperCase from 'lodash/upperCase';

import BaseExchange from '../base/BaseExchange';
import NotSupported from '../base/errors/NotSupported';
import ExchangeError from '../base/errors/ExchangeError';
import { ORDER_TYPES, ORDER_STATUSES } from '../../constants';
import {
  REQUIRED_CREDENTIALS,
  URLS,
  FEES,
  API,
  SIGNED_APIS,
  TIMEFRAMES,
} from './constants';
import GdaxParser from './GdaxParser';

import { parse8601, ymdhms } from '../../utils/time';
import debug from '../../utils/debug';

class Gdax extends BaseExchange {
  static Parser = GdaxParser;
  static REQUIRED_CREDENTIALS = REQUIRED_CREDENTIALS;
  static URLS = URLS;
  static FEES = FEES;
  static API = API;
  static SIGNED_APIS = SIGNED_APIS;

  getSignature({
    nonce, method, url, data,
  }) {
    const body = data ? JSON.stringify(data) : '';
    const strForSign = nonce + upperCase(method) + url + body;

    const key = Buffer.from(this.apiSecret, 'base64');

    return crypto.createHmac('sha256', key).update(strForSign).digest('base64');
  }

  sign({ method, url, data }) {
    const nonce = Date.now() / 1000;

    if (this.verbose) {
      debug(`Signing with ${nonce}, method: ${method}, path: ${url}, data: ${data}`);
    }

    return {
      headers: {
        'CB-ACCESS-KEY': this.apiKey,
        'CB-ACCESS-SIGN': this.getSignature({
          method,
          url,
          data,
          nonce,
        }),
        'CB-ACCESS-TIMESTAMP': nonce,
        'CB-ACCESS-PASSPHRASE': this.password,
      },
    };
  }

  async fetchMarkets() {
    const markets = await this.api.public.get.products();

    return this.parser.parseMarkets(markets);
  }

  async fetchBalance() {
    await this.loadMarkets();

    const balances = await this.api.private.get.accounts();

    return this.parser.parseBalances(balances);
  }

  async fetchOrderBook({ symbol, params = {} } = {}) {
    await this.loadMarkets();

    const orderbook = await this.api.public.get.productsIdBook({
      id: this.marketId(symbol),
      params: {
        level: 2, // 1 best bidask, 2 aggregated, 3 full
        ...params,
      },
    });

    return this.parser.parseOrderBook(orderbook);
  }

  async fetchTicker({ symbol, params = {} } = {}) {
    await this.loadMarkets();

    const market = this.market(symbol);

    const ticker = await this.api.public.get.productsIdTicker({
      id: market.id,
      params,
    });

    return this.parser.parseTicker(ticker, symbol);
  }

  async fetchMyTrades({
    symbol, since, limit, params = {},
  } = {}) {
    await this.loadMarkets();

    let market;
    const request = {};

    if (symbol) {
      market = this.market(symbol);
      request.product_id = market.id;
    }

    const response = await this.api.private.get.fills({
      ...request,
      params: {
        limit,
        ...params,
      },
    });

    return this.parser.parseTrades(
      response,
      market,
      since,
      limit,
      this.marketsById,
    );
  }

  async fetchTrades({
    symbol, since, limit, params = {},
  } = {}) {
    await this.loadMarkets();

    const market = this.market(symbol);
    const response = await this.api.public.get.productsIdTrades({
      id: market.id, // fixes issue #2
      params,
    });

    return this.parser.parseTrades(
      response,
      market,
      since,
      limit,
      this.marketsById,
    );
  }

  async fetchOHLCV({
    symbol, timeframe = '1m', since, limit, params = {},
  } = {}) {
    await this.loadMarkets();
    const market = this.market(symbol);
    const granularity = TIMEFRAMES[timeframe];
    const setupParams = {
      granularity,
      limit,
    };

    if (since) {
      setupParams.start = ymdhms(since);

      if (!limit) {
        // https://docs.gdax.com/#get-historic-rates
        setupParams.limit = 350; // max = 350
      }

      setupParams.end = ymdhms(sum([limit * granularity * 1000, since]));
    }

    const response = await this.api.public.get.productsIdCandles({
      id: market.id,
      params: { ...setupParams, granularity, ...params },
    });

    return this.parser.parseOHLCVs(response, market, timeframe, since, limit);
  }

  async fetchTime() {
    const response = await this.api.public.get.time();

    return parse8601(response.iso);
  }

  async fetchOrder({ id, params = {} } = {}) {
    await this.loadMarkets();

    const response = await this.api.private.get.ordersId({
      id,
      params,
    });

    return this.parser.parseOrder(response);
  }

  async fetchOrders({
    symbol, since, limit, params = {},
  } = {}) {
    await this.loadMarkets();

    const request = {};

    let market;

    if (symbol) {
      market = this.market(symbol);

      request.product_id = market.id;
    }

    const response = await this.api.private.get.orders({
      ...request,
      params: { ...params, status: ORDER_STATUSES.LOWER.ALL },
    });

    return this.parser.parseOrders(response, market, since, limit);
  }

  async fetchOpenOrders({
    symbol, since, limit, params = {},
  } = {}) {
    await this.loadMarkets();

    const request = {};
    let market;

    if (symbol) {
      market = this.market(symbol);
      request.product_id = market.id;
    }

    const response = await this.api.private.get.orders({ ...request, params });

    return this.parser.parseOrders(response, market, since, limit);
  }

  async fetchClosedOrders({
    symbol = undefined,
    since = undefined,
    limit = undefined,
    params = {},
  } = {}) {
    await this.loadMarkets();

    const request = {};

    let market;

    if (symbol) {
      market = this.market(symbol);
      request.product_id = market.id;
    }

    const response = await this.api.private.get.orders({
      ...request,
      params: { ...params, status: ORDER_STATUSES.LOWER.DONE },
    });

    return this.parser.parseOrders(response, market, since, limit);
  }

  // TODO: Add more order types
  async createOrder({
    market, type, side, amount, price, params = {},
  } = {}) {
    await this.loadMarkets();
    // let oid = this.nonce ().toString ();
    const order = {
      product_id: this.marketId(market),
      side,
      size: amount,
      type,
      ...params,
    };

    if (type === ORDER_TYPES.LOWER.LIMIT) {
      order.price = price;
    }

    const response = await this.api.private.post.orders({ data: order });

    return {
      info: response,
      id: response.id,
    };
  }

  async cancelOrder({ id }) {
    await this.loadMarkets();

    const response = await this.api.private.delete.ordersId({ id });

    return response;
  }

  async getPaymentMethods() {
    const response = await this.api.private.get.paymentMethods();

    return response;
  }

  async deposit({ currency, amount, params = {} } = {}) {
    await this.loadMarkets();

    const request = {
      currency,
      amount,
    };
    let method = 'api.private.post.deposits';

    if ('payment_method_id' in params) {
      // deposit from a payment_method, like a bank account
      method += 'PaymentMethod';
    } else if ('coinbase_account_id' in params) {
      // deposit into GDAX account from a Coinbase account
      method += 'CoinbaseAccount';
    } else {
      // deposit methodotherwise we did not receive a supported deposit location
      // relevant docs link for the Googlers
      // https://docs.gdax.com/#deposits
      throw new NotSupported('Gdax deposit() requires one of `coinbase_account_id` or `payment_method_id` extra params');
    }

    const methodFunction = get(this, method);
    const response = await methodFunction({ ...request, ...params });

    if (!response) {
      throw new ExchangeError(`Gdax deposit() error: ${JSON.stringify(response)}`);
    }

    return {
      info: response,
      id: response.id,
    };
  }

  async withdraw({
    currency, amount, address, params = {},
  } = {}) {
    await this.loadMarkets();

    const data = {
      currency,
      amount,
    };
    let method = 'api.private.post.withdrawals';

    if ('payment_method_id' in params) {
      method += 'PaymentMethod';
    } else if ('coinbase_account_id' in params) {
      method += 'CoinbaseAccount';
    } else {
      method += 'Crypto';
      data.crypto_address = address;
    }

    const methodFunction = get(this, method);
    const response = await methodFunction({ data, params });

    if (!response) {
      throw new ExchangeError(`Gdax withdraw() error: ${JSON.stringify(response)}`);
    }

    return {
      info: response,
      id: response.id,
    };
  }
}

export default Gdax;
