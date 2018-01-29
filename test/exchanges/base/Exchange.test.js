import Exchange from '../../../src/exchanges/base/Exchange';

describe('Exchange', () => {
  describe('params', () => {
    class MyExchange extends Exchange {}

    MyExchange.requiredConfig = ['apiKey', 'apiSecret'];
    MyExchange.baseUrl = 'base';
    MyExchange.api = {
      public: { get: ['url/one'] },
    };
    test('should error when passing incomplete required params', () => {
      expect(() => new MyExchange({ apiKey: 'apiKey' })).toThrowError();
    });

    test('should not error when passing complete required params', () => {
      expect(() => new MyExchange({ apiKey: 'apiKey', apiSecret: 'apiSecret' })).not.toThrowError();
    });
  });

  describe('baseUrl', () => {
    class MyExchange extends Exchange {}
    MyExchange.api = {
      public: { get: ['url/one'] },
    };

    test('should error when baseUrl is missing', () => {
      expect(() => new MyExchange()).toThrowError();
    });

    test('should not error when baseUrl is present', () => {
      MyExchange.baseUrl = 'base';

      expect(() => new MyExchange()).not.toThrowError();
    });
  });

  describe('api methods', () => {
    test('should set api methods', () => {
      class MyExchange extends Exchange {
        static api = {
          public: { get: ['url/one'] },
        };

        static baseUrl = 'base';
      }

      const instance = new MyExchange();

      expect(instance.api).toBeTruthy();
    });
  });
});
