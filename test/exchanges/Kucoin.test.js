import Kucoin from '../../src/exchanges/Kucoin';

describe('Kucoin', () => {
  test('should not error without params', () => {
    expect(() => new Kucoin()).not.toThrowError();
  });

  test('should not error with api key and secret', () => {
    expect(() => new Kucoin({ apiKey: 'key', apiSecret: 'secret' })).not.toThrowError();
  });
});
