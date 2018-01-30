import crypto from 'crypto';
import axios from 'axios';
import qs from 'qs';
import isEmpty from 'lodash/isEmpty';
import forEach from 'lodash/forEach';
import groupBy from 'lodash/groupBy';
import sortBy from 'lodash/sortBy';
import sortedIndexBy from 'lodash/sortedIndexBy';
import flatten from 'lodash/flatten';
import merge from 'lodash/merge';
import omit from 'lodash/omit';
import camelCase from 'lodash/camelCase';

import NotImplemented from './errors/NotImplemented';
import ExchangeError from './errors/ExchangeError';
import AuthenticationError from './errors/AuthenticationError';

class Exchange {
  constructor({
    apiKey, apiSecret, uid, password,
  } = {}) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.uid = uid;
    this.password = password;

    this.validateRequiredConfig(apiKey, apiSecret, uid, password);

    this.client = axios.create({
      timeout: this.timeout,
    });

    this.setApiMethods();
  }

  substituteCommonCurrencyCodes = true;
  timeout = 1000;

  balance = {};
  orderbooks = {};
  tickers = {};
  orders = {};
  trades = {};

  rawRequest(method, endpoint, signed = false, params = {}) {
    const path = endpoint;
    const nonce = new Date().getTime();
    const isParamsEmpty = isEmpty(params);
    const queryString = isParamsEmpty ? '' : qs.stringify(params);

    const options = {
      url: `${path}${isParamsEmpty ? '' : `?${queryString}`}`,
      headers: {},
      method,
    };

    if (signed) {
      options.headers = this.getHeaders(path, queryString, nonce);
    }

    return this.client(options);
  }

  getSignature(path, queryString, nonce) {
    const strForSign = `${path}/${nonce}/${queryString}`;
    const signatureStr = Buffer.from(strForSign).toString('base64');
    const signatureResult = crypto
      .createHmac('sha256', this.apiSecret)
      .update(signatureStr)
      .digest('hex');

    return signatureResult;
  }

  request = (method, endpoint, params) =>
    this.rawRequest(method, endpoint, false, params);

  signedRequest = (method, endpoint, params) => {
    const containsAllParams = this.constructor.requiredConfig.every(param => this[param]);

    if (!containsAllParams) {
      throw new AuthenticationError(`Cannot sign request as ${this.constructor.requiredConfig.join(', ')} required`);
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

    forEach(this.constructor.urls.api, (baseUrl, name) => {
      this.api[name] = {};

      forEach(this.constructor.api[name], (urlArray, method) => {
        this.setApiMethodsFromArray(method, urlArray, name, baseUrl);
      });
    });
  };

  setApiMethodsFromArray = (method, urlArray, name, baseUrl) => {
    const isPrivate = name === 'private';

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
    if (this.has.fetchCurrencies) {
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
        this.fees.trading,
        market,
      ));
    this.markets = merge(this.markets, sortedIndexBy(values, 'symbol'));
    this.marketsById = sortedIndexBy(markets, 'id');
    this.markets_by_id = this.marketsById;
    this.symbols = Object.keys(this.markets).sort();
    this.ids = Object.keys(this.markets_by_id).sort();
    if (currencies) {
      this.currencies = merge(currencies, this.currencies);
    } else {
      const baseCurrencies = values
        .filter(market => 'base' in market)
        .map(market => ({
          id: market.baseId || market.base,
          code: market.base,
          precision: market.precision
            ? market.precision.base || market.precision.amount
            : 8,
        }));
      const quoteCurrencies = values
        .filter(market => 'quote' in market)
        .map(market => ({
          id: market.quoteId || market.quote,
          code: market.quote,
          precision: market.precision
            ? market.precision.quote || market.precision.price
            : 8,
        }));
      const allCurrencies = baseCurrencies.concat(quoteCurrencies);
      const groupedCurrencies = groupBy(allCurrencies, 'code');
      const currentCurrencies = Object.keys(groupedCurrencies).map(code =>
        groupedCurrencies[code].reduce(
          (previous, current) =>
            (previous.precision > current.precision ? previous : current),
          groupedCurrencies[code][0],
        ));
      const sortedCurrencies = sortBy(flatten(currentCurrencies), 'code');
      this.currencies = merge(
        sortedIndexBy(sortedCurrencies, 'code'),
        this.currencies,
      );
    }
    this.currencies_by_id = sortedIndexBy(this.currencies, 'id');
    return this.markets;
  }

  parseBalance(balance) {
    const currencies = Object.keys(omit(balance, 'info'));
    const result = { ...balance };

    currencies.forEach((currency) => {
      if (typeof balance[currency].used === 'undefined') {
        if (this.parseBalanceFromOpenOrders && 'open_orders' in balance.info) {
          const exchangeOrdersCount = balance.info.open_orders;
          const cachedOrdersCount = Object.values(this.orders).filter(order => order.status === 'open').length;
          if (cachedOrdersCount === exchangeOrdersCount) {
            result[currency].used = this.getCurrencyUsedOnOpenOrders(currency);
            result[currency].total =
              balance[currency].used + balance[currency].free;
          }
        } else {
          result[currency].used = this.getCurrencyUsedOnOpenOrders(currency);
          result[currency].total =
            balance[currency].used + balance[currency].free;
        }
      }

      ['free', 'used', 'total'].forEach((account) => {
        result[account] = balance[account] || {};
        result[account][currency] = balance[currency][account];
      });
    });

    return result;
  }

  market(symbol) {
    if (typeof this.markets === 'undefined') {
      return new ExchangeError(`${this.id} markets not loaded`);
    }

    if (typeof symbol === 'string' && symbol in this.markets) {
      return this.markets[symbol];
    }

    throw new ExchangeError(`${this.id} does not have market symbol ${symbol}`);
  }

  // Validations
  validateRequiredConfig(apiKey, apiSecret, uid, password) {
    if (apiKey || apiSecret || uid || password) {
      const containsAllParams = this.constructor.requiredConfig.every(param => this[param]);

      if (!containsAllParams) {
        throw new ExchangeError('Does not have all required params');
      }
    }
  }

  // Methods to override
  // eslint-disable-next-line class-methods-use-this
  getHeaders() {
    throw new NotImplemented('`getHeaders` not implemented');
  }
}

export default Exchange;
