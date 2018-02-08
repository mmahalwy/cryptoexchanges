import axios from 'axios';
import keyByFn from 'lodash/keyBy';

const BASE_URL = 'https://api.coinmarketcap.com/v1';

export const fetchTickers = async ({
  start, limit, convert, keyBy,
} = {}) => {
  const { data } = await axios.get(`${BASE_URL}/ticker/`, {
    params: {
      start,
      limit,
      convert,
    },
  });

  if (keyBy) {
    return keyByFn(data, keyBy);
  }

  return data;
};

export const fetchTicker = async ({ id, symbol, convert } = {}) => {
  if (id) {
    const data = await fetchTickers({ convert, keyBy: 'id' });

    return data[id];
  }

  if (symbol) {
    const data = await fetchTickers({ convert, keyBy: 'symbol' });

    return data[symbol];
  }

  return null;
};

export const fetchGlobalMarket = async ({ convert } = {}) => {
  const { data } = await axios.get(`${BASE_URL}/global`, {
    params: {
      convert,
    },
  });

  return data;
};
