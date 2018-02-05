import Gdax from '../../../src/exchanges/Gdax';
import { METHODS } from '../../../src/exchanges/Gdax/constants';
import { ORDER_TYPES, ORDER_SIDES, ORDER_STATUSES } from '../../../src/constants';

let gdax;
const symbol = 'ETH/USD';
const id = 123;
const param = 1;

describe('GDAX', () => {
  beforeEach(() => {
    gdax = new Gdax({
      apiKey: 'key',
      apiSecret: 'secret',
      password: 'password',
    });

    gdax.api.public.get.products = jest.fn(() => Promise.resolve([]));

    gdax.markets = {
      [symbol]: {
        id: symbol,
      },
    };

    gdax.marketsById = gdax.markets;
  });

  METHODS.forEach((method) => {
    test(`should contain required method ${method}`, () => {
      expect(gdax[method]).toBeTruthy();
    });
  });

  describe('#getSignature', () => {
    test('should return signature', () => {
      expect(gdax.getSignature({
        nonce: Date.now(),
        method: 'GET',
        path: '/path',
        data: {},
      })).not.toBeNull();
    });
  });

  describe('#sign', () => {
    test('should return options for request', () => {
      const payload = {
        nonce: Date.now(),
        method: 'GET',
        path: '/path',
        data: {},
      };

      expect(gdax.sign(payload)).toEqual({
        headers: {
          'CB-ACCESS-KEY': gdax.apiKey,
          'CB-ACCESS-SIGN': gdax.getSignature(payload),
          'CB-ACCESS-TIMESTAMP': payload.nonce,
          'CB-ACCESS-PASSPHRASE': gdax.password,
        },
      });
    });
  });

  describe('#fetchTime', () => {
    test('should call api.public.get.time', () => {
      const stub = jest.fn(() => Promise.resolve({ iso: '2018-02-05T01:57:40.482Z' }));

      gdax.api.public.get.time = stub;

      gdax.fetchTime();

      expect(stub).toHaveBeenCalled();
    });
  });

  describe('#fetchMarkets', () => {
    test('should call api.public.get.products', () => {
      const stub = jest.fn(() => Promise.resolve([]));

      gdax.api.public.get.products = stub;

      gdax.fetchMarkets();

      expect(stub).toHaveBeenCalled();
    });
  });

  describe('#fetchBalance', () => {
    test('should call api.public.get.products', async () => {
      const stub = jest.fn(() => Promise.resolve([]));

      gdax.api.private.get.accounts = stub;

      await gdax.fetchBalance();

      expect(stub).toHaveBeenCalled();
    });
  });

  describe('#fetchOrderBook', () => {
    test('should call api.public.get.productsIdBook', async () => {
      const stub = jest.fn(() => Promise.resolve([]));

      gdax.api.public.get.productsIdBook = stub;

      await gdax.fetchOrderBook({ symbol });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const level = 1;
      const stub = jest.fn(() => Promise.resolve([]));

      gdax.rawRequest = stub;

      await gdax.fetchOrderBook({ symbol, params: { level } });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith(
        'get',
        Gdax.URLS.api.public,
        `/products/${symbol}/book`,
        false,
        { id: symbol, params: { level } },
      );
    });
  });

  describe('#fetchTicker', () => {
    test('should call api.public.get.productsIdTicker', async () => {
      const stub = jest.fn(() => Promise.resolve([]));

      gdax.api.public.get.productsIdTicker = stub;

      await gdax.fetchTicker({ symbol });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const level = 1;
      const stub = jest.fn(() => Promise.resolve([]));

      gdax.rawRequest = stub;

      await gdax.fetchTicker({ symbol, params: { level } });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith(
        'get',
        Gdax.URLS.api.public,
        `/products/${symbol}/ticker`,
        false,
        { id: symbol, params: { level } },
      );
    });
  });

  describe('#fetchMyTrades', () => {
    test('should call api.private.get.fills', async () => {
      const stub = jest.fn(() => Promise.resolve([]));

      gdax.api.private.get.fills = stub;

      await gdax.fetchMyTrades({ symbol });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve([]));

      gdax.rawRequest = stub;

      await gdax.fetchMyTrades({ symbol, params: { param } });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith('get', Gdax.URLS.api.private, '/fills', true, {
        product_id: symbol,
        params: { limit: undefined, param },
      });
    });
  });

  describe('#fetchTrades', () => {
    test('should call api.public.get.productsIdTrades', async () => {
      const stub = jest.fn(() => Promise.resolve([]));

      gdax.api.public.get.productsIdTrades = stub;

      await gdax.fetchTrades({ symbol });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve([]));

      gdax.rawRequest = stub;

      await gdax.fetchTrades({ symbol, params: { param } });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith(
        'get',
        Gdax.URLS.api.public,
        `/products/${symbol}/trades`,
        false,
        {
          id: symbol,
          params: { param },
        },
      );
    });
  });

  describe('#fetchOHLCV', () => {
    test('should call api.public.get.productsIdCandles', async () => {
      const stub = jest.fn(() => Promise.resolve([]));

      gdax.api.public.get.productsIdCandles = stub;

      await gdax.fetchOHLCV({ symbol });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve([]));

      gdax.rawRequest = stub;

      await gdax.fetchOHLCV({ symbol, params: { param } });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith(
        'get',
        Gdax.URLS.api.public,
        `/products/${symbol}/candles`,
        false,
        {
          id: symbol,
          params: { granularity: 60, limit: undefined, param },
        },
      );
    });
  });

  describe('#fetchOrder', () => {
    const order = { product_id: id, created_at: '2018-02-05T01:57:40.482Z' };

    test('should call api.private.get.ordersId', async () => {
      const stub = jest.fn(() => Promise.resolve(order));

      gdax.api.private.get.ordersId = stub;

      await gdax.fetchOrder({ id });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve(order));

      gdax.rawRequest = stub;

      await gdax.fetchOrder({ id, params: { param } });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith('get', Gdax.URLS.api.private, `/orders/${id}`, true, {
        id,
        params: { param },
      });
    });
  });

  describe('#fetchOrders', () => {
    const order = { product_id: id, created_at: '2018-02-05T01:57:40.482Z' };

    test('should call api.private.get.orders', async () => {
      const stub = jest.fn(() => Promise.resolve([order]));

      gdax.api.private.get.orders = stub;

      await gdax.fetchOrders({ symbol });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve([order]));

      gdax.rawRequest = stub;

      await gdax.fetchOrders({ symbol, params: { param } });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith('get', Gdax.URLS.api.private, '/orders', true, {
        product_id: symbol,
        params: { status: ORDER_STATUSES.LOWER_CASE.ALL, param },
      });
    });
  });

  describe('#fetchOpenOrders', () => {
    const order = { product_id: id, created_at: '2018-02-05T01:57:40.482Z' };

    test('should call api.private.get.orders', async () => {
      const stub = jest.fn(() => Promise.resolve([order]));

      gdax.api.private.get.orders = stub;

      await gdax.fetchOpenOrders({ symbol });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve([order]));

      gdax.rawRequest = stub;

      await gdax.fetchOpenOrders({ symbol, params: { param } });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith('get', Gdax.URLS.api.private, '/orders', true, {
        product_id: symbol,
        params: { param },
      });
    });
  });

  describe('#fetchClosedOrders', () => {
    const order = { product_id: id, created_at: '2018-02-05T01:57:40.482Z' };

    test('should call api.private.get.orders', async () => {
      const stub = jest.fn(() => Promise.resolve([order]));

      gdax.api.private.get.orders = stub;

      await gdax.fetchClosedOrders({ symbol });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve([order]));

      gdax.rawRequest = stub;

      await gdax.fetchClosedOrders({ symbol, params: { param } });

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith('get', Gdax.URLS.api.private, '/orders', true, {
        product_id: symbol,
        params: { status: ORDER_STATUSES.LOWER_CASE.DONE, param },
      });
    });
  });

  describe('#createOrder', () => {
    const order = { product_id: id, created_at: '2018-02-05T01:57:40.482Z' };

    test('should call api.private.post.orders', async () => {
      const stub = jest.fn(() => Promise.resolve(order));

      gdax.api.private.post.orders = stub;

      await gdax.createOrder({ market: symbol });

      expect(stub).toHaveBeenCalled();
    });

    test('should pass correct client arguments', async () => {
      const stub = jest.fn(() => Promise.resolve(order));

      gdax.rawRequest = stub;

      await gdax.createOrder({
        market: symbol, price: 1, side: ORDER_SIDES.LOWER_CASE.BUY, type: ORDER_TYPES.LOWER_CASE.LIMIT, amount: 1, params: { param } 
});

      expect(stub).toHaveBeenCalled();
      expect(stub).toHaveBeenCalledWith('post', Gdax.URLS.api.private, '/orders', true, {
        data: {
 product_id: symbol, price: 1, type: ORDER_TYPES.LOWER_CASE.LIMIT, side: ORDER_SIDES.LOWER_CASE.BUY, size: 1, param 
},
      });
    });
  });
});
