import Binance from '../../../src/exchanges/Binance';
import {
  METHODS,
  TIMEFRAMES,
  DEFAULT_OHLCV_LIMIT,
} from '../../../src/exchanges/Binance/constants';
import {
  ORDER_TYPES,
  ORDER_SIDES,
} from '../../../src/constants';
import { markets, ticker, orderBook, order, myTrades, aggTrades } from './mocks';

let binance;
const symbol = 'ETH/BTC';
const market = 'ETHBTC';
const param = 1;
const id = 123;

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
    binance = new Binance({
      apiKey: 'key',
      apiSecret: 'secret',
    });

    binance.api.public.get.exchangeInfo = jest.fn(() =>
      Promise.resolve({
        symbols: markets,
      }));
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

      expect(binance.getSignature({
        path,
        params,
        timestamp,
      })).not.toBeNull();
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
      binance.api.public.get.time = jest.fn(() =>
        Promise.resolve({
          serverTime: 123,
        }));

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
      const stub = jest.fn(() =>
        Promise.resolve({
          balances: [],
        }));

      binance.api.private.get.account = stub;

      await binance.fetchBalance();

      expect(stub).toHaveBeenCalled();
    });
  });

  describe('#fetchOrderBook', () => {
    test('should return order book', async () => {
      const stub = jest.fn(() => Promise.resolve(orderBook));
      binance.api.public.get.depth = stub;

      const response = await binance.fetchOrderBook({
        symbol,
      });

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
      expect(stub).toHaveBeenCalledWith(
        'get',
        Binance.URLS.api.public,
        '/depth',
        false,
        {
          params: {
            symbol: market,
            param,
            limit: 100,
          },
        },
      );
    });
  });

  describe('#fetchTicker', () => {
    test('should return order book', async () => {
      const stub = jest.fn(() => Promise.resolve(ticker));

      binance.api.public.get.ticker24Hr = stub;

      const response = await binance.fetchTicker({
        symbol,
      });

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
      expect(stub).toHaveBeenCalledWith(
        'get',
        Binance.URLS.api.public,
        '/ticker/24hr',
        false,
        {
          params: {
            symbol: market,
            param,
          },
        },
      );
    });
  });

  describe('#fetchBidAsks', () => {
    test('should return bids and asks', async () => {
      const bidsAsks = [
        {
          symbol: 'ETHBTC',
          bidPrice: '0.09478200',
          bidQty: '0.48200000',
          askPrice: '0.09480100',
          askQty: '0.00100000',
        },
      ];
      const stub = jest.fn(() => Promise.resolve(bidsAsks));
      binance.api.public.get.tickerBookTicker = stub;

      await binance.fetchBidAsks({
        symbol,
      });

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

      await binance.fetchTickers({
        symbol,
      });

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
      expect(stub).toHaveBeenCalledWith(
        'get',
        Binance.URLS.api.public,
        '/ticker/24hr',
        false,
        {
          params: {
            param,
          },
        },
      );
    });
  });

  describe('#fetchOHLCV', () => {
    test('should return candles', async () => {
      // TODO: real data
      const stub = jest.fn(() => Promise.resolve([ticker]));
      binance.api.public.get.klines = stub;

      await binance.fetchOHLCV({
        symbol,
      });

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
      expect(stub).toHaveBeenCalledWith(
        'get',
        Binance.URLS.api.public,
        '/klines',
        false,
        {
          params: {
            symbol: market,
            interval: TIMEFRAMES['1m'],
            limit: DEFAULT_OHLCV_LIMIT,
            param,
          },
        },
      );
    });
  });

  describe('#fetchTrades', () => {
    test('should return trades', async () => {
      // TODO: real data
      const stub = jest.fn(() => Promise.resolve(aggTrades));
      binance.api.public.get.aggTrades = stub;

      await binance.fetchTrades({
        symbol,
      });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve(aggTrades));

      binance.rawRequest = stub;

      await binance.fetchTrades({
        symbol,
        params: {
          param,
        },
      });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith(
        'get',
        Binance.URLS.api.public,
        '/aggTrades',
        false,
        {
          symbol: market,
          params: {
            symbol: market,
            param,
          },
        },
      );
    });
  });

  describe('#createOrder', () => {
    const payload = {
      symbol,
      price: 1,
      type: ORDER_TYPES.LOWER.LIMIT,
      params: { param },
      amount: 1,
      side: ORDER_SIDES.BUY,
    };

    test('should create order', async () => {
      // TODO: real data
      const stub = jest.fn(() => Promise.resolve(order));
      binance.api.private.post.order = stub;

      await binance.createOrder(payload);

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() =>
        Promise.resolve({
          time: 123,
          orderId: 123,
        }));

      binance.rawRequest = stub;

      await binance.createOrder(payload);

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith(
        'post',
        Binance.URLS.api.private,
        '/order',
        true,
        {
          data: {
            symbol: market,
            type: payload.type.toUpperCase(),
            price: '1.000000',
            quantity: '1.000',
            side: ORDER_SIDES.BUY,
            timeInForce: 'GTC',
            param,
          },
        },
      );
    });
  });

  describe('#fetchOrder', () => {
    test('should return order', async () => {
      // TODO: real data
      const stub = jest.fn(() => Promise.resolve(order));
      binance.api.private.get.order = stub;

      await binance.fetchOrder({
        id,
        symbol,
      });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve(order));

      binance.rawRequest = stub;

      await binance.fetchOrder({
        id,
        symbol,
        params: {
          param,
        },
      });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith(
        'get',
        Binance.URLS.api.private,
        '/order',
        true,
        {
          orderId: id,
          symbol: market,
          params: {
            param,
          },
        },
      );
    });
  });

  describe('#fetchOrders', () => {
    test('should return orders', async () => {
      // TODO: real data
      const stub = jest.fn(() => Promise.resolve([order]));
      binance.api.private.get.allOrders = stub;

      await binance.fetchOrders({
        symbol,
      });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve([order]));

      binance.rawRequest = stub;

      await binance.fetchOrders({
        symbol,
        params: {
          param,
        },
      });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith(
        'get',
        Binance.URLS.api.private,
        '/allOrders',
        true,
        {
          symbol: market,
          params: {
            param,
          },
        },
      );
    });
  });

  describe('#fetchOpenOrders', () => {
    test('should return open orders', async () => {
      // TODO: real data
      const stub = jest.fn(() => Promise.resolve([order]));
      binance.api.private.get.openOrders = stub;

      await binance.fetchOpenOrders({
        symbol,
      });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve([order]));

      binance.rawRequest = stub;

      await binance.fetchOpenOrders({
        symbol,
        params: {
          param,
        },
      });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith(
        'get',
        Binance.URLS.api.private,
        '/openOrders',
        true,
        {
          symbol: market,
          params: {
            param,
          },
        },
      );
    });
  });

  describe('#fetchMyTrades', () => {
    test('should return open orders', async () => {
      // TODO: real data
      const stub = jest.fn(() => Promise.resolve(myTrades));
      binance.api.private.get.myTrades = stub;

      await binance.fetchMyTrades({
        symbol,
      });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve(myTrades));

      binance.rawRequest = stub;

      await binance.fetchMyTrades({
        symbol,
        params: {
          param,
        },
      });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith(
        'get',
        Binance.URLS.api.private,
        '/myTrades',
        true,
        {
          symbol: market,
          params: {
            param,
          },
        },
      );
    });
  });

  describe('#withdraw', () => {
    const address = 'address';
    const amount = 1;
    const currency = 'CUR';

    test('should return withdraw order', async () => {
      // TODO: real data
      const stub = jest.fn(() => Promise.resolve({}));
      binance.api.wapi.post.withdraw = stub;

      await binance.withdraw({
        address,
        amount,
        currency,
      });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve({}));

      binance.rawRequest = stub;

      await binance.withdraw({
        address,
        amount,
        currency,
        params: {
          param,
        },
      });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith(
        'post',
        Binance.URLS.api.wapi,
        '/withdraw',
        true,
        {
          data: {
            address,
            amount,
            asset: currency,
            name: address,
            param,
          },
        },
      );
    });
  });

  describe('#fetchDepositAddress', () => {
    const currency = 'CUR';

    test('should return deposit address', async () => {
      // TODO: real data
      const stub = jest.fn(() => Promise.resolve({ success: true }));
      binance.api.wapi.get.depositAddress = stub;

      await binance.fetchDepositAddress({
        currency,
      });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve({ success: true }));

      binance.rawRequest = stub;

      await binance.fetchDepositAddress({
        currency,
        params: {
          param,
        },
      });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith(
        'get',
        Binance.URLS.api.wapi,
        '/depositAddress',
        true,
        {
          asset: currency,
          params: {
            param,
          },
        },
      );
    });
  });
});
