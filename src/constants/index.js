import mapValues from 'lodash/mapValues';
import lowerCase from 'lodash/lowerCase';

const makeLowerCaseVersion = (constants) => {
  // eslint-disable-next-line no-param-reassign
  constants.LOWER = mapValues(constants, lowerCase);

  return constants;
};

export const ORDER_TYPES = makeLowerCaseVersion({
  LIMIT: 'LIMIT',
});

export const ORDER_SIDES = makeLowerCaseVersion({
  BUY: 'BUY',
  SELL: 'SELL',
});

export const ORDER_STATUSES = makeLowerCaseVersion({
  OPEN: 'OPEN',
  DONE: 'DONE',
  ALL: 'ALL',
});

export const BALANCE_TYPES = makeLowerCaseVersion({
  FREE: 'FREE',
  USED: 'USED',
  TOTAL: 'TOTAL',
});
