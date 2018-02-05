import Binance from '../../../src/exchanges/Binance';
import { METHODS, TIMEFRAMES, DEFAULT_OHLCV_LIMIT } from '../../../src/exchanges/Binance/constants';
import { ORDER_TYPES, ORDER_SIDES, ORDER_STATUSES } from '../../../src/constants';

let binance;
const symbol = 'ETH/BTC';
const market = 'ETHBTC';
const id = 123;
const param = 1;
const markets = [
  {
    symbol: 'ETHBTC',
    status: 'TRADING',
    baseAsset: 'ETH',
    baseAssetPrecision: 8,
    quoteAsset: 'BTC',
    quotePrecision: 8,
    orderTypes: ['LIMIT', 'LIMIT_MAKER', 'MARKET', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT_LIMIT'],
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

    binance.api.public.get.exchangeInfo = jest.fn(() => Promise.resolve({ symbols: markets }));
  });

  METHODS.forEach((method) => {
    test(`should contain required method ${method}`, () => {
      expect(binance[method]).toBeTruthy();
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
        nonce: timestamp,
      })).toEqual({
        params: {
          ...params,
          timestamp,
          signature: binance.getSignature(path, params, timestamp),
        },
        headers: {
          'X-MBX-APIKEY': binance.apiKey,
        },
      });
    });
  });

  describe('#loadTimeDifference', () => {
    test('should time difference', async () => {
      binance.api.public.get.time = jest.fn(() => Promise.resolve({ serverTime: 123 }));

      const timeDiff = await binance.loadTimeDifference();

      expect(timeDiff).toBeGreaterThan(1);
    });
  });

  describe('#fetchMarkets', () => {
    test('should call loadTimeDifference when adjustForTimeDifference is true', async () => {
      const loadTimeDifferenceStub = jest.fn();

      binance.adjustForTimeDifference = true;
      binance.loadTimeDifference = loadTimeDifferenceStub;

      await binance.fetchMarkets();

      expect(loadTimeDifferenceStub).toHaveBeenCalled();
    });

    test('should return markets with correct fields', async () => {
      const response = await binance.fetchMarkets();
      const firstMarket = response[0];

      MARKETS_FIELDS.forEach((field) => {
        expect(firstMarket).toHaveProperty(field);
      });
    });
  });

  describe('#fetchBalance', () => {
    test('should call api.private.get.account', async () => {
      const stub = jest.fn(() => Promise.resolve({ balances: [] }));

      binance.api.private.get.account = stub;

      await binance.fetchBalance();

      expect(stub).toHaveBeenCalled();
    });
  });

  describe('#fetchOrderBook', () => {
    test('should return order book', async () => {
      const stub = jest.fn(() => Promise.resolve(orderBook));
      binance.api.public.get.depth = stub;

      const response = await binance.fetchOrderBook({ symbol: 'ETH/BTC' });

      expect(stub).toHaveBeenCalled();
      expect(response).toHaveProperty('timestamp');
      expect(response).toHaveProperty('datetime');
      expect(response).toHaveProperty('bids');
      expect(response).toHaveProperty('asks');
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve([]));

      binance.rawRequest = stub;

      await binance.fetchOrderBook({
        symbol,
        params: {
          param,
        },
      });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith('get', Binance.URLS.api.public, '/depth', false, {
        params: {
          symbol: market,
          param,
          limit: 100,
        },
      });
    });
  });

  describe('#fetchTicker', () => {
    test('should return order book', async () => {
      const stub = jest.fn(() => Promise.resolve(ticker));

      binance.api.public.get.ticker24Hr = stub;

      const response = await binance.fetchTicker({ symbol: 'ETH/BTC' });

      expect(stub).toHaveBeenCalled();
      TICKER_FIELDS.forEach((field) => {
        expect(response).toHaveProperty(field);
      });
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve([]));

      binance.rawRequest = stub;

      await binance.fetchTicker({
        symbol,
        params: {
          param,
        },
      });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith('get', Binance.URLS.api.public, '/ticker/24hr', false, {
        params: {
          symbol: market,
          param,
        },
      });
    });
  });

  describe('#fetchBidAsks', () => {
    test('should return bids and asks', async () => {
      // TODO: get correct data
      const stub = jest.fn(() => Promise.resolve([ticker]));
      binance.api.public.get.tickerBookTicker = stub;

      await binance.fetchBidAsks({ symbol: 'ETH/BTC' });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve([]));

      binance.rawRequest = stub;

      await binance.fetchBidAsks({
        params: {
          param,
        },
      });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith(
        'get',
        Binance.URLS.api.public,
        '/ticker/bookTicker',
        false,
        {
          params: {
            param,
          },
        },
      );
    });
  });

  describe('#fetchTickers', () => {
    test('should return tickers', async () => {
      const stub = jest.fn(() => Promise.resolve([ticker]));
      binance.api.public.get.ticker24Hr = stub;

      await binance.fetchTickers({ symbol: 'ETH/BTC' });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve([]));

      binance.rawRequest = stub;

      await binance.fetchTickers({
        params: {
          param,
        },
      });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith('get', Binance.URLS.api.public, '/ticker/24hr', false, {
        params: {
          param,
        },
      });
    });
  });

  describe('#fetchOHLCV', () => {
    test('should return candles', async () => {
      // TODO: real data
      const stub = jest.fn(() => Promise.resolve([ticker]));
      binance.api.public.get.klines = stub;

      await binance.fetchOHLCV({ symbol: 'ETH/BTC' });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve([]));

      binance.rawRequest = stub;

      await binance.fetchOHLCV({
        symbol,
        params: {
          param,
        },
      });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith('get', Binance.URLS.api.public, '/klines', false, {
        params: {
          symbol: market,
          interval: TIMEFRAMES['1m'],
          limit: DEFAULT_OHLCV_LIMIT,
          param,
        },
      });
    });
  });

  describe.skip('#fetchTrades', () => {
    test('should return trades', async () => {
      // TODO: real data
      const stub = jest.fn(() => Promise.resolve([ticker]));
      binance.api.public.get.aggTrades = stub;

      await binance.fetchTrades({ symbol: 'ETH/BTC' });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve([]));

      binance.rawRequest = stub;

      await binance.fetchTrades({
        symbol,
        params: {
          param,
        },
      });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith('get', Binance.URLS.api.public, '/klines', false, {
        params: {
          symbol: market,
          interval: TIMEFRAMES['1m'],
          limit: DEFAULT_OHLCV_LIMIT,
          param,
        },
      });
    });
  });

  describe('#createOrder', () => {
    const payload = { symbol: 'ETH/BTC', type: ORDER_TYPES.LOWER_CASE.LIMIT };
    const order = { time: 123, orderId: 123 };

    test('should create order', async () => {
      // TODO: real data
      const stub = jest.fn(() => Promise.resolve(order));
      binance.api.private.post.order = stub;

      await binance.createOrder(payload);

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve({ time: 123, orderId: 123 }));

      binance.rawRequest = stub;

      await binance.createOrder(payload);

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith('post', Binance.URLS.api.private, '/order', true, {
        data: {
          symbol: market,
          type: payload.type,
          param,
        },
      });
    });
  });
});
