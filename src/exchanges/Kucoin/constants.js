export const REQUIRED_CREDENTIALS = ['apiKey', 'apiSecret'];
export const URLS = {
  logo:
    'https://user-images.githubusercontent.com/1294454/33795655-b3c46e48-dcf6-11e7-8abe-dc4588ba7901.jpg',
  api: {
    public: 'https://api.kucoin.com/v1',
    private: 'https://api.kucoin.com/v1',
    kitchen: 'https://kitchen.kucoin.com',
  },
  www: 'https://kucoin.com',
  doc: 'https://kucoinapidocs.docs.apiary.io',
  FEES: 'https://news.kucoin.com/en/fee',
};
export const FEES = {
  trading: {
    maker: 0.001,
    taker: 0.001,
  },
};
export const API = {
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
export const SIGNED_APIS = ['private'];
