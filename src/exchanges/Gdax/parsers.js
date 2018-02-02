import get from 'lodash/get';
import toInteger from 'lodash/toInteger';

import { MAKER, TAKER, ORDER_TYPE } from './constants';
import { iso8601 as iso8601Fn, parse8601 } from '../../utils/time';

export const parseTrade = (trade, market, marketsById) => {
  let timestamp;
  if ('time' in trade) {
    timestamp = parse8601(trade.time);
  } else if ('created_at' in trade) {
    timestamp = parse8601(trade.created_at);
  }
  let iso8601;

  if (typeof timestamp !== 'undefined') {
    iso8601 = iso8601Fn(timestamp);
  }

  const side = trade.side === ORDER_TYPE.BUY ? ORDER_TYPE.SELL : ORDER_TYPE.BUY;
  let symbol;

  if (!market) {
    if ('product_id' in trade) {
      const marketId = trade.product_id;

      if (marketsById[marketId]) {
        // eslint-disable-next-line no-param-reassign
        market = marketsById[marketId];
      }
    }
  }

  if (market) {
    // eslint-disable-next-line prefer-destructuring
    symbol = market.symbol;
  }

  let feeRate;
  let feeCurrency;

  if (market) {
    feeCurrency = market.quote;
    if ('liquidity' in trade) {
      const rateType = trade.liquidity === 'T' ? TAKER : MAKER;
      feeRate = market[rateType];
    }
  }

  let feeCost = toInteger(trade.fill_fees);

  if (!feeCost) feeCost = toInteger(trade.fee);

  const fee = {
    cost: feeCost,
    currency: feeCurrency,
    rate: feeRate,
  };

  let type;
  const id = get(trade, 'trade_id');
  const orderId = get(trade, 'order_id');
  return {
    id,
    order: orderId,
    info: trade,
    timestamp,
    datetime: iso8601,
    symbol,
    type,
    side,
    price: toInteger(trade.price),
    amount: toInteger(trade.size),
    fee,
  };
};

export const parseOHLCV = ohlcv => [
  ohlcv[0] * 1000,
  ohlcv[3],
  ohlcv[2],
  ohlcv[1],
  ohlcv[4],
  ohlcv[5],
];
