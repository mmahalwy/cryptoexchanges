import Exchange from './base/Exchange';
import { precisionFromString } from '../utils//number';

class Gdax extends Exchange {
  async fetchMarkets() {
    const markets = await this.api.get.products();
    const result = [];
    for (let p = 0; p < markets.length; p++) {
      const market = markets[p];
      const id = market.id;
      const base = market.base_currency;
      const quote = market.quote_currency;
      const symbol = `${base}/${quote}`;
      const priceLimits = {
        min: this.safeFloat(market, 'quote_increment'),
        max: undefined,
      };
      const precision = {
        amount: 8,
        price: precisionFromString(market.quote_increment),
      };
      let taker = this.constructor.fees.trading.taker;

      if (base === 'ETH' || base === 'LTC') {
        taker = 0.003;
      }
      const active = market.status === 'online';
      result.push({
        ...this.constructor.fees.trading,
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
    }
    return result;
  }
}

Gdax.requiredConfig = ['apiKey', 'apiSecret', 'password'];
Gdax.urls = {
  logo: 'https://user-images.githubusercontent.com/1294454/27766527-b1be41c6-5edb-11e7-95f6-5b496c469e2c.jpg',
  api: {
    public: 'https://api.gdax.com',
    private: 'https://api.gdax.com',
  },
  www: 'https://kucoin.com',
  doc: 'https://kucoinapidocs.docs.apiary.io',
  fees: 'https://news.kucoin.com/en/fee',
};
Gdax.fees = {
  trading: {
    tierBased: true, // complicated tier system per coin
    percentage: true,
    maker: 0.0,
    taker: 0.25 / 100, // Fee is 0.25%, 0.3% for ETH/LTC pairs
  },
};
Gdax.api = {
  public: {
    get: [
      '/currencies',
      '/products',
      '/products/{id}/book',
      '/products/{id}/candles',
      '/products/{id}/stats',
      '/products/{id}/ticker',
      '/products/{id}/trades',
      '/time',
    ],
  },
  private: {
    get: [
      '/accounts',
      '/accounts/{id}',
      '/accounts/{id}/holds',
      '/accounts/{id}/ledger',
      '/accounts/{id}/transfers',
      '/coinbase-accounts',
      '/fills',
      '/funding',
      '/orders',
      '/orders/{id}',
      '/payment-methods',
      '/position',
      '/reports/{id}',
      '/users/self/trailing-volume',
    ],
    post: [
      '/deposits/coinbase-account',
      '/deposits/payment-method',
      '/funding/repay',
      '/orders',
      '/position/close',
      '/profiles/margin-transfer',
      '/reports',
      '/withdrawals/coinbase',
      '/withdrawals/crypto',
      '/withdrawals/payment-method',
    ],
    delete: ['/orders', '/orders/{id}'],
  },
};

export default Gdax;
