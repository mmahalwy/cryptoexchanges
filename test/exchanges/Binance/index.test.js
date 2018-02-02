import Binance from '../../../src/exchanges/Binance';
import { METHODS } from '../../../src/exchanges/Binance/constants';

let binance;
const markets = [
  {
    symbol: 'ETHBTC',
    status: 'TRADING',
    baseAsset: 'ETH',
    baseAssetPrecision: 8,
    quoteAsset: 'BTC',
    quotePrecision: 8,
    orderTypes: [
      'LIMIT',
      'LIMIT_MAKER',
      'MARKET',
      'STOP_LOSS_LIMIT',
      'TAKE_PROFIT_LIMIT',
    ],
    icebergAllowed: true,
    filters: [
      {
        filterType: 'PRICE_FILTER',
        minPrice: '0.00000100',
        maxPrice: '100000.00000000',
        tickSize: '0.00000100',
      },
      {
        filterType: 'LOT_SIZE',
        minQty: '0.00100000',
        maxQty: '100000.00000000',
        stepSize: '0.00100000',
      },
      {
        filterType: 'MIN_NOTIONAL',
        minNotional: '0.00100000',
      },
    ],
  },
];
const orderBook = {
  lastUpdateId: 100951632,
  bids: [['0.11312300', '1.57800000', []]],
  asks: [['0.11312300', '1.57800000', []]],
};
const ticker = {
  symbol: 'ETHBTC',
  priceChange: '0.00546200',
  priceChangePercent: '5.073',
  weightedAvgPrice: '0.11026035',
  prevClosePrice: '0.10767300',
  lastPrice: '0.11313500',
  lastQty: '0.06100000',
  bidPrice: '0.11313500',
  bidQty: '0.00100000',
  askPrice: '0.11321600',
  askQty: '7.08100000',
  openPrice: '0.10767300',
  highPrice: '0.11411900',
  lowPrice: '0.10690000',
  volume: '108008.44000000',
  quoteVolume: '11909.04836175',
  openTime: 1517382804353,
  closeTime: 1517469204353,
  firstId: 27897964,
  lastId: 28169819,
  count: 271856,
};

const MARKETS_FIELDS = [
  'tierBased',
  'percentage',
  'taker',
  'maker',
  'id',
  'symbol',
  'base',
  'quote',
  'baseId',
  'quoteId',
  'info',
  'lot',
  'active',
  'precision',
  'limits',
];

const TICKER_FIELDS = [
  'symbol',
  'timestamp',
  'datetime',
  'high',
  'low',
  'bid',
  'bidVolume',
  'ask',
  'askVolume',
  'vwap',
  'open',
  'close',
  'first',
  'last',
  'change',
  'percentage',
  'average',
  'baseVolume',
  'quoteVolume',
  'info',
];

describe('Binance', () => {
  beforeEach(() => {
    binance = new Binance({ apiKey: 'key', apiSecret: 'secret' });
  });

  METHODS.forEach((method) => {
    test(`should contain required method ${method}`, () => {
      expect(binance[method]).toBeTruthy();
    });
  });

  describe('#getHeaders', () => {
    test('should return headers when signed', () => {
      expect(binance.getHeaders(true)).toEqual({
        'X-MBX-APIKEY': binance.apiKey,
      });
    });

    test('should return headers not when signed', () => {
      expect(binance.getHeaders()).toEqual({});
    });
  });

  describe('#getSignature', () => {
    test('should return signature', () => {
      const path = '/path';
      const params = {};
      const timestamp = Date.now();

      expect(binance.getSignature({ path, params, timestamp })).not.toBeNull();
    });
  });

  describe('#sign', () => {
    test('should return options', () => {
      const options = {};
      const path = '/path';
      const params = {};
      const timestamp = Date.now();

      binance.getSignature = jest.fn(() => 'signature');

      expect(binance.sign({
        options,
        path,
        params,
        timestamp,
      })).toEqual({
        params: {
          ...params,
          timestamp,
          signature: binance.getSignature(path, params, timestamp),
        },
        headers: {},
      });
    });
  });

  describe('#loadTimeDifference', () => {
    test('should time difference', async () => {
      binance.api.public.get.time = jest.fn(() =>
        Promise.resolve({ serverTime: 123 }));

      const timeDiff = await binance.loadTimeDifference();

      expect(timeDiff).toBeGreaterThan(1);
    });
  });

  describe('#fetchMarkets', () => {
    test('should call loadTimeDifference when adjustForTimeDifference is true', async () => {
      const loadTimeDifferenceStub = jest.fn();

      binance.adjustForTimeDifference = true;
      binance.loadTimeDifference = loadTimeDifferenceStub;
      binance.api.public.get.exchangeInfo = jest.fn(() =>
        Promise.resolve({ symbols: markets }));

      await binance.fetchMarkets();

      expect(loadTimeDifferenceStub).toHaveBeenCalled();
    });

    test('should return markets with correct fields', async () => {
      binance.api.public.get.exchangeInfo = jest.fn(() =>
        Promise.resolve({ symbols: markets }));

      const response = await binance.fetchMarkets();
      const firstMarket = response[0];

      MARKETS_FIELDS.forEach((field) => {
        expect(firstMarket).toHaveProperty(field);
      });
    });
  });

  describe('#fetchOrderBook', () => {
    test('should return order book', async () => {
      binance.api.public.get.exchangeInfo = jest.fn(() =>
        Promise.resolve({ symbols: markets }));
      binance.api.public.get.depth = jest.fn(() => Promise.resolve(orderBook));

      const response = await binance.fetchOrderBook('ETH/BTC');

      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('datetime');
      expect(response).toHaveProperty('bids');
      expect(response).toHaveProperty('asks');
    });
  });

  describe('#fetchTicker', () => {
    test('should return order book', async () => {
      binance.api.public.get.exchangeInfo = jest.fn(() =>
        Promise.resolve({ symbols: markets }));
      binance.api.public.get.ticker24Hr = jest.fn(() =>
        Promise.resolve(ticker));

      const response = await binance.fetchTicker('ETH/BTC');

      TICKER_FIELDS.forEach((field) => {
        expect(response).toHaveProperty(field);
      });
    });
  });
});
