export const REQUIRED_CREDENTIALS = ['apiKey', 'apiSecret', 'password'];
export const URLS = {
  logo:
    'https://user-images.githubusercontent.com/1294454/27766527-b1be41c6-5edb-11e7-95f6-5b496c469e2c.jpg',
  api: {
    public: 'https://api.gdax.com',
    private: 'https://api.gdax.com',
  },
};
export const FEES = {
  trading: {
    tierBased: true, // complicated tier system per coin
    percentage: true,
    maker: 0.0,
    taker: 0.25 / 100, // Fee is 0.25%, 0.3% for ETH/LTC pairs
  },
};
export const API = {
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
      '/payment-METHODS',
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
export const SIGNED_APIS = ['private'];
export const TIMEFRAMES = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '2h': 7200,
  '4h': 14400,
  '12h': 43200,
  '1d': 86400,
  '1w': 604800,
  '1M': 2592000,
  '1y': 31536000,
};

export const METHODS = [
  'fetchMarkets',
  'fetchOHLCV',
  'deposit',
  'withdraw',
  'fetchOrder',
  'fetchOrders',
  'fetchOpenOrders',
  'fetchClosedOrders',
  'fetchMyTrades',
];

export const BASE_ASSETS = {
  LTC: 'LTC',
  ETH: 'ETH',
};

export const NON_BTC_TAKER = 0.003;

export const MARKET_STATUS = {
  ONLINE: 'online',
};
