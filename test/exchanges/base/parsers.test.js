import BaseParser from '../../../src/exchanges/base/BaseParser';

let parser;
describe('base parsers', () => {
  beforeEach(() => {
    parser = new BaseParser();
  });

  describe('filterBySinceLimit', () => {
    const array = [
      { timestamp: 1 },
      { timestamp: 2 },
      { timestamp: 3 },
      { timestamp: 4 },
    ];

    test('should return array when since and limit are not passed', () => {
      expect(parser.filterBySinceLimit(array)).toEqual(array);
    });

    test('should return array filtered by since', () => {
      expect(parser.filterBySinceLimit(array, 2)).toEqual([
        { timestamp: 3 },
        { timestamp: 4 },
      ]);
    });

    test('should return array filtered by limit', () => {
      expect(parser.filterBySinceLimit(array, undefined, 2)).toEqual([
        { timestamp: 1 },
        { timestamp: 2 },
      ]);
    });

    test('should return array filtered by since and limit', () => {
      expect(parser.filterBySinceLimit(array, 1, 2)).toEqual([
        { timestamp: 2 },
        { timestamp: 3 },
      ]);
    });
  });

  describe('parseOHLCV', () => {
    test('should return OHLCV', () => {
      const EMPTY = {};
      expect(parser.parseOHLCV(EMPTY)).toEqual(EMPTY);
    });
  });

  describe('parseBalance', () => {
    test('should return balance', () => {
      const balance = {
        info: '',
        'A/B': {},
        'C/D': {},
      };

      expect(parser.parseBalance(balance));
    });
  });
});
