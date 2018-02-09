/* eslint-disable global-require, import/no-extraneous-dependencies */
import repl from 'repl';
import os from 'os';
import path from 'path';
import logger from 'better-log';

const decache = require('decache');

logger.setConfig({ depth: null });
const historyFile = path.join(os.homedir(), '.node_history');

const replServer = repl.start({
  prompt: 'ccel > ',
  useColors: true,
});

const log = async (promise) => {
  try {
    const response = await promise;
    replServer.context.response = response;
    logger(response);

    return response;
  } catch (e) {
    // eslint-disable-next-line
    console.error(e);

    return null;
  }
};

const reload = () => {
  decache('./src/marketcap');
  decache('./src/Aggregation');
  decache('./src/exchanges/Binance');
  decache('./src/exchanges/Gdax');

  const marketcap = require('./src/marketcap');
  const Aggregation = require('./src/Aggregation').default;

  const Binance = require('./src/exchanges/Binance').default;
  // import Kucoin from './src/exchanges/Kucoin';
  const Gdax = require('./src/exchanges/Gdax').default;

  const binanceParams = process.env.BINANCE_API_KEY
    ? {
      apiKey: process.env.BINANCE_API_KEY,
      apiSecret: process.env.BINANCE_API_SECRET,
      verbose: true,
    }
    : {
      verbose: true,
    };
  const gdaxParams = process.env.GDAX_API_KEY
    ? {
      apiKey: process.env.GDAX_API_KEY,
      apiSecret: process.env.GDAX_API_SECRET,
      password: process.env.GDAX_PASSPHRASE,
      verbose: true,
    }
    : {
      verbose: true,
    };

  const gdax = new Gdax(gdaxParams);
  const binance = new Binance(binanceParams);
  const aggregation = new Aggregation({
    exchanges: [gdax, binance],
  });

  // attach my modules to the repl context
  replServer.context.Binance = Binance;
  replServer.context.binance = binance;
  // replServer.context.Kucoin = Kucoin;
  // replServer.context.kucoin = new Kucoin();
  replServer.context.Gdax = Gdax;
  replServer.context.gdax = gdax;
  replServer.context.Aggregation = Aggregation;
  replServer.context.aggregation = aggregation;
  replServer.context.agg = aggregation;
  replServer.context.marketcap = marketcap;
};

reload();

replServer.context.reload = reload;
replServer.context.r = reload;
replServer.context.log = log;

require('repl.history')(replServer, historyFile);
