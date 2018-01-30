import Exchange from '../../../src/exchanges/base/Exchange';

describe('Exchange', () => {
  describe('params', () => {
    class MyExchange extends Exchange {
      static api = {
        public: { get: ['url/one'] },
      };

      static urls = {
        logo: 'logo',
        api: {
          public: 'https://api.exchange.com',
          private: 'https://api.exchange.com',
          kitchen: 'https://kitchen.exchange.com',
        },
      };

      static requiredConfig = ['apiKey', 'apiSecret'];
    }

    test('should error when passing incomplete required params', () => {
      expect(() => new MyExchange({ apiKey: 'apiKey' })).toThrowError();
    });

    test('should not error when passing complete required params', () => {
      expect(() => new MyExchange({ apiKey: 'apiKey', apiSecret: 'apiSecret' })).not.toThrowError();
    });
  });

  describe('api methods', () => {
    test('should set api methods', () => {
      class MyExchange extends Exchange {
        static api = {
          public: { get: ['url/one'] },
          private: { get: ['url/one'] },
          kitchen: { get: ['url/one'] },
        };

        static urls = {
          logo: 'logo',
          api: {
            public: 'https://api.exchange.com',
            private: 'https://api.exchange.com',
            kitchen: 'https://kitchen.exchange.com',
          },
        };
      }

      const instance = new MyExchange();

      expect(instance.api).toBeTruthy();
      expect(instance.api.public).toBeTruthy();
      expect(instance.api.public.get.urlOne).toBeTruthy();
      expect(instance.api.private).toBeTruthy();
      expect(instance.api.private.get.urlOne).toBeTruthy();
      expect(instance.api.kitchen).toBeTruthy();
      expect(instance.api.kitchen.get.urlOne).toBeTruthy();
    });

    test('should call signedRequest when private', () => {
      class MyExchange extends Exchange {
        static api = {
          public: { get: ['url/one'] },
          private: { get: ['url/one'] },
          kitchen: { get: ['url/one'] },
        };

        static urls = {
          logo: 'logo',
          api: {
            public: 'https://api.exchange.com',
            private: 'https://api.exchange.com',
            kitchen: 'https://kitchen.exchange.com',
          },
        };

        getHeaders() {
          return { key: this.apiKey };
        }
      }

      const instance = new MyExchange();
      const signedRequestStub = jest.fn();

      instance.signedRequest = signedRequestStub;
      instance.api.private.get.urlOne();

      expect(signedRequestStub).toHaveBeenCalled();
    });

    test('should call request when not private', () => {
      class MyExchange extends Exchange {
        static api = {
          public: { get: ['url/one'] },
          private: { get: ['url/one'] },
          kitchen: { get: ['url/one'] },
        };

        static urls = {
          logo: 'logo',
          api: {
            public: 'https://api.exchange.com',
            private: 'https://api.exchange.com',
            kitchen: 'https://kitchen.exchange.com',
          },
        };

        getHeaders() {
          return { key: this.apiKey };
        }
      }

      const instance = new MyExchange();
      const requestStub = jest.fn();

      instance.request = requestStub;
      instance.api.public.get.urlOne();

      expect(requestStub).toHaveBeenCalled();
    });
  });
});
