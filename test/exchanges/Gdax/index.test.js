import Gdax from '../../../src/exchanges/Gdax';
import { METHODS } from '../../../src/exchanges/Gdax/constants';

let gdax;

describe('GDAX', () => {
  beforeEach(() => {
    gdax = new Gdax({
      apiKey: 'key',
      apiSecret: 'secret',
      password: 'password',
    });
  });

  METHODS.forEach((method) => {
    test(`should contain required method ${method}`, () => {
      expect(gdax[method]).toBeTruthy();
    });
  });
});
