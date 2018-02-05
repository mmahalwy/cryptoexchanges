export const REQUIRED_CREDENTIALS = ['apiKey', 'apiSecret'];

export const URLS = {
  logo:
    'https://user-images.githubusercontent.com/1294454/29604020-d5483cdc-87ee-11e7-94c7-d1a8d9169293.jpg',
  api: {
    web: 'https://www.binance.com',
    wapi: 'https://api.binance.com/wapi/v3',
    public: 'https://api.binance.com/api/v1',
    private: 'https://api.binance.com/api/v3',
    v3: 'https://api.binance.com/api/v3',
    v1: 'https://api.binance.com/api/v1',
  },
  www: 'https://www.binance.com',
  doc: 'https://github.com/binance-exchange/binance-official-api-docs/blob/master/rest-api.md',
  FEES: [
    'https://binance.zendesk.com/hc/en-us/articles/115000429332',
    'https://support.binance.com/hc/en-us/articles/115000583311',
  ],
};

export const FEES = {
  trading: {
    tierBased: false,
    percentage: true,
    taker: 0.001,
    maker: 0.001,
  },
};

export const API = {
  web: {
    get: ['/exchange/public/product'],
  },
  wapi: {
    post: ['/withdraw'],
    get: ['/depositHistory', '/withdrawHistory', '/depositAddress'],
  },
  v3: {
    get: ['/ticker/price', '/ticker/bookTicker'],
  },
  public: {
    get: [
      '/exchangeInfo',
      '/ping',
      '/time',
      '/depth',
      '/aggTrades',
      '/klines',
      '/ticker/24hr',
      '/ticker/allPrices',
      '/ticker/allBookTickers',
      '/ticker/price',
      '/ticker/bookTicker',
    ],
  },
  private: {
    get: ['/order', '/openOrders', '/allOrders', '/account', '/myTrades'],
    post: ['/order', '/order/test'],
    delete: ['/order'],
  },
  v1: {
    put: ['/userDataStream'],
    post: ['/userDataStream'],
    delete: ['/userDataStream'],
  },
};

export const METHODS = [
  'fetchMarkets',
  'fetchDepositAddress',
  'fetchTickers',
  'fetchOHLCV',
  'fetchMyTrades',
  'fetchOrder',
  'fetchOrders',
  'fetchOpenOrders',
  'withdraw',
];

export const SIGNED_APIS = ['private', 'wapi'];

export const TIMEFRAMES = {
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '2h': '2h',
  '4h': '4h',
  '6h': '6h',
  '8h': '8h',
  '12h': '12h',
  '1d': '1d',
  '3d': '3d',
  '1w': '1w',
  '1M': '1M',
};

export const NULL_ID = '123456';
export const MAKER = 'maker';
export const TAKER = 'taker';

export const ORDER_TYPE = {
  BUY: 'buy',
  SELL: 'sell',
  LIMIT: 'limit',
};

export const TIME_IN_FORCE = {
  GTC: 'GTC', // 'GTC' = Good To Cancel (default)
  IOC: 'IOC', // 'IOC' = Immediate Or Cancel
};

export const MARKET_STATUS = {
  TRADING: 'TRADING',
};

export const ORDER_STATUSES = {
  NEW: 'NEW',
  PARTIALLY_FILLED: 'PARTIALLY_FILLED',
  FILLED: 'FILLED',
  CANCELED: 'CANCELED',
};

export const DEFAULT_OHLCV_LIMIT = 500;