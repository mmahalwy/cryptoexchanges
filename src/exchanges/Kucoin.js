import Exchange from './base/Exchange';

const BASE_URL = 'https://api.kucoin.com/v1';

class Kucoin extends Exchange {
  getHeaders(path, queryString, nonce) {
    return {
      'KC-API-KEY': this.apiKey,
      'KC-API-NONCE': nonce,
      'KC-API-SIGNATURE': this.getSignature(path, queryString, nonce),
    };
  }

  fetchUserInfo() {
    return this.signedRequest('get', '/user/info');
  }

  async fetchMarkets() {
    const response = await this.request('get', 'market/open/symbols');
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
        ...this.fees.trading,
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
    const { data: currencies } = await this.request(
      'get',
      'market/open/coins',
      params,
    );
    const result = {};

    currencies.forEeach((currency) => {
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

  async fetchBalance(params = {}) {
    await this.loadMarkets();

    const {
      data: balances,
    } = await this.signedRequest('get', 'account/balance', {
      limit: 20, // default 12, max 20
      page: 1,
      ...params,
    });

    const result = { info: balances };
    const indexed = this.indexBy(balances, 'coinType');
    const keys = Object.keys(indexed);

    keys.forEach((id) => {
      const currency = this.commonCurrencyCode(id);
      const account = this.account();
      const balance = indexed[id];
      const used = parseFloat(balance.freezeBalance);
      const free = parseFloat(balance.balance);
      const total = this.sum(free, used);
      account.free = free;
      account.used = used;
      account.total = total;
      result[currency] = account;
    });

    return this.parseBalance(result);
  }
}

Kucoin.baseUrl = BASE_URL;
Kucoin.requiredConfig = ['apiKey', 'apiSecret'];
Kucoin.trading = {
  maker: 0.0010,
  taker: 0.0010,
};
Kucoin.api = {
  kitchen: {
    get: ['open/chart/history'],
  },
  public: {
    get: [
      'open/chart/config',
      'open/chart/history',
      'open/chart/symbol',
      'open/currencies',
      'open/deal-orders',
      'open/kline',
      'open/lang-list',
      'open/orders',
      'open/orders-buy',
      'open/orders-sell',
      'open/tick',
      'market/open/coin-info',
      'market/open/coins',
      'market/open/coins-trending',
      'market/open/symbols',
    ],
  },
  private: {
    get: [
      'account/balance',
      'account/{coin}/wallet/address',
      'account/{coin}/wallet/records',
      'account/{coin}/balance',
      'account/promotion/info',
      'account/promotion/sum',
      'deal-orders',
      'order/active',
      'order/active-map',
      'order/dealt',
      'referrer/descendant/count',
      'user/info',
    ],
    post: [
      'account/{coin}/withdraw/apply',
      'account/{coin}/withdraw/cancel',
      'cancel-order',
      'order',
      'user/change-lang',
    ],
  },
};

export default Kucoin;
