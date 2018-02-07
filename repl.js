import repl from 'repl';
import os from 'os';
import path from 'path';
import logger from 'better-log';

import Binance from './src/exchanges/Binance';
// import Kucoin from './src/exchanges/Kucoin';
import Gdax from './src/exchanges/Gdax';

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
    console.error(e);
    throw e;
  }
};

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

// attach my modules to the repl context
replServer.context.Binance = Binance;
replServer.context.binance = new Binance(binanceParams);
// replServer.context.Kucoin = Kucoin;
// replServer.context.kucoin = new Kucoin();
replServer.context.Gdax = Gdax;
replServer.context.gdax = new Gdax(gdaxParams);
replServer.context.log = log;

require('repl.history')(replServer, historyFile);
