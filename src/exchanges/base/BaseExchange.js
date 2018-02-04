import axios from 'axios';
import forEach from 'lodash/forEach';
import groupBy from 'lodash/groupBy';
import sortBy from 'lodash/sortBy';
import keyBy from 'lodash/keyBy';
import flatten from 'lodash/flatten';
import merge from 'lodash/merge';
import camelCase from 'lodash/camelCase';
import isString from 'lodash/isString';

import ExchangeError from './errors/ExchangeError';
import AuthenticationError from './errors/AuthenticationError';

const EMPTY_OBJECT = {};

class Exchange {
  constructor({
    apiKey, apiSecret, uid, password, includeInfo = false,
  } = {}) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.uid = uid;
    this.password = password;

    this.includeInfo = includeInfo;

    this.validateRequiredConfig(apiKey, apiSecret, uid, password);
    this.validateParser();

    this.client = axios.create({
      timeout: this.timeout,
    });

    this.parser = new this.constructor.Parser({ includeInfo });

    this.setApiMethods();
  }

  substituteCommonCurrencyCodes = true;
  adjustForTimeDifference = false;
  timeDifference = null;
  timeout = 1000;

  balance = {};
  orderbooks = {};
  tickers = {};
  orders = {};
  trades = {};
  markets = null;
  marketsById = null;

  async rawRequest(method, endpoint, signed = false, params = {}) {
    const path = endpoint;
    const nonce = new Date().getTime();

    const options = {
      url: path,
      headers: {},
      method,
      params,
    };

    if (signed) {
      merge(
        options,
        this.sign({
          options,
          path,
          params,
          nonce,
          signed,
        }),
      );
    }

    try {
      const response = await this.client(options);

      return response.data;
    } catch (e) {
      console.error(e);

      throw e;
    }
  }

  request = (method, endpoint, params) => this.rawRequest(method, endpoint, false, params);

  signedRequest = (method, endpoint, params) => {
    const containsAllParams = this.constructor.REQUIRED_CREDENTIALS.every(param => this[param]);

    if (!containsAllParams) {
      throw new AuthenticationError(`Cannot sign request as ${this.constructor.REQUIRED_CREDENTIALS.join(', ')} required`);
    }

    return this.rawRequest(method, endpoint, true, params);
  };

  commonCurrencyCode(currency) {
    if (!this.substituteCommonCurrencyCodes) return currency;
    if (currency === 'XBT') return 'BTC';
    if (currency === 'BCC') return 'BCH';
    if (currency === 'DRK') return 'DASH';

    return currency;
  }

  setApiMethods = () => {
    this.api = {};

    forEach(this.constructor.URLS.api, (baseUrl, name) => {
      this.api[name] = {};

      forEach(this.constructor.API[name], (urlArray, method) => {
        this.setApiMethodsFromArray(method, urlArray, name, baseUrl);
      });
    });
  };

  setApiMethodsFromArray = (method, urlArray, name, baseUrl) => {
    const isPrivate = this.constructor.SIGNED_APIS.includes(name);

    urlArray.forEach((url) => {
      this.api[name][method] = this.api[name][method] || {};

      this.api[name][method][camelCase(url)] = (params) => {
        const requestMethod = isPrivate ? this.signedRequest : this.request;

        return requestMethod(method, `${baseUrl}${url}`, params);
      };
    });
  };

  async loadMarkets(reload = false) {
    if (!reload && this.markets) {
      if (!this.marketsById) {
        return this.setMarkets(this.markets);
      }
      return this.markets;
    }

    const markets = await this.fetchMarkets();
    let currencies;

    if (this.fetchCurrencies) {
      currencies = await this.fetchCurrencies();
    }

    return this.setMarkets(markets, currencies);
  }

  setMarkets(markets, currencies = undefined) {
    const values = Object.values(markets).map(market =>
      merge(
        {
          limits: this.limits,
          precision: this.precision,
        },
        this.constructor.FEES.trading,
        market,
      ));

    this.markets = merge(this.markets, keyBy(values, 'symbol'));
    this.marketsById = keyBy(markets, 'id');
    this.symbols = Object.keys(this.markets).sort();
    this.ids = Object.keys(this.marketsById).sort();

    if (currencies) {
      this.currencies = merge(currencies, this.currencies);
    } else {
      const baseCurrencies = values.filter(market => 'base' in market).map(market => ({
        id: market.baseId || market.base,
        code: market.base,
        precision: market.precision ? market.precision.base || market.precision.amount : 8,
      }));
      const quoteCurrencies = values.filter(market => 'quote' in market).map(market => ({
        id: market.quoteId || market.quote,
        code: market.quote,
        precision: market.precision ? market.precision.quote || market.precision.price : 8,
      }));
      const allCurrencies = baseCurrencies.concat(quoteCurrencies);
      const groupedCurrencies = groupBy(allCurrencies, 'code');
      const currentCurrencies = Object.keys(groupedCurrencies).map(code =>
        groupedCurrencies[code].reduce(
          (previous, current) => (previous.precision > current.precision ? previous : current),
          groupedCurrencies[code][0],
        ));
      const sortedCurrencies = sortBy(flatten(currentCurrencies), 'code');

      this.currencies = merge(keyBy(sortedCurrencies, 'code'), this.currencies);
    }

    this.currencies_by_id = keyBy(this.currencies, 'id');

    return this.markets;
  }

  market(symbol) {
    if (this.markets === EMPTY_OBJECT) {
      return new ExchangeError(`${this.id} markets not loaded`);
    }

    if (isString(symbol) && this.markets[symbol]) {
      return this.markets[symbol];
    }

    throw new ExchangeError(`${this.id} does not have market symbol ${symbol}`);
  }

  costToPrecision(symbol, cost) {
    return parseFloat(cost).toFixed(this.markets[symbol].precision.price);
  }

  feeToPrecision(symbol, fee) {
    return parseFloat(fee).toFixed(this.markets[symbol].precision.price);
  }

  getCurrencyUsedOnOpenOrders(currency) {
    return Object.values(this.orders)
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
  }

  // Validations
  // TODO: Move this elsewhere
  validateRequiredConfig(apiKey, apiSecret, uid, password) {
    if (apiKey || apiSecret || uid || password) {
      const containsAllParams = this.constructor.REQUIRED_CREDENTIALS.every(param => this[param]);

      if (!containsAllParams) {
        throw new ExchangeError('Does not have all required params');
      }
    }
  }

  validateParser() {
    if (!this.constructor.Parser) {
      throw new ExchangeError('Does not have parser set');
    }
  }

  // Methods to override
  // eslint-disable-next-line class-methods-use-this
  getHeaders() {
    return {};
  }
}

export default Exchange;
