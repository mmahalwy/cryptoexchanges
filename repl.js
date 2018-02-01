import repl from 'repl';
import os from 'os';
import path from 'path';

import Binance from './src/exchanges/Binance';
import Kucoin from './src/exchanges/Kucoin';

const log = async (promise) => {
  try {
    const response = await promise;
    console.log(response);

    return response;
  } catch (e) {
    console.error(e);
    throw e;
  }
};

const historyFile = path.join(os.homedir(), '.node_history');

const replServer = repl.start({
  prompt: 'ccel > ',
  useColors: true,
});

// attach my modules to the repl context
replServer.context.Binance = Binance;
replServer.context.binance = new Binance();
replServer.context.Kucoin = Kucoin;
replServer.context.kucoin = new Kucoin();
replServer.context.log = log;

require('repl.history')(replServer, historyFile);
