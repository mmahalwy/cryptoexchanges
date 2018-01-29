import repl from 'repl';
import os from 'os';
import path from 'path';

import Binance from './src/exchanges/Binance';

const historyFile = path.join(os.homedir(), '.node_history');

const replServer = repl.start({
  prompt: 'ccel > ',
  useColors: true,
});

// attach my modules to the repl context
replServer.context.Binance = Binance;

require('repl.history')(replServer, historyFile);
