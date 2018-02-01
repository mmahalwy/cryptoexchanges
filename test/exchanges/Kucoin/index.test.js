import Kucoin from '../../../src/exchanges/Kucoin';

let kucoin;
const REQUIRED_METHODS = [
  'fetchMarkets',
  'fetchBalance',
  'fetchOrderBook',
  'fetchTicker',
  'fetchBidAsks',
  'fetchTickers',
  'fetchOHLCV',
  'fetchTrades',
  'createOrder',
  'fetchOrder',
  'fetchOrders',
  'fetchOpenOrders',
];

describe('Kucoin', () => {
  beforeEach(() => {
    kucoin = new Kucoin({ apiKey: 'key', apiSecret: 'secret' });
  });

  REQUIRED_METHODS.forEach((method) => {
    // TODO: change this.
    test.skip(`should contain required method ${method}`, () => {
      expect(kucoin[method]).toBeTruthy();
    });
  });

  test('should not error without params', () => {
    expect(() => new Kucoin()).not.toThrowError();
  });

  test('should not error with api key and secret', () => {
    expect(() => new Kucoin({ apiKey: 'key', apiSecret: 'secret' })).not.toThrowError();
  });
});
