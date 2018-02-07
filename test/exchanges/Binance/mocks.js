export const markets = [
  {
    symbol: 'ETHBTC',
    status: 'TRADING',
    baseAsset: 'ETH',
    baseAssetPrecision: 8,
    quoteAsset: 'BTC',
    quotePrecision: 8,
    orderTypes: [
      'LIMIT',
      'LIMIT_MAKER',
      'MARKET',
      'STOP_LOSS_LIMIT',
      'TAKE_PROFIT_LIMIT',
    ],
    icebergAllowed: true,
    filters: [
      {
        filterType: 'PRICE_FILTER',
        minPrice: '0.00000100',
        maxPrice: '100000.00000000',
        tickSize: '0.00000100',
      },
      {
        filterType: 'LOT_SIZE',
        minQty: '0.00100000',
        maxQty: '100000.00000000',
        stepSize: '0.00100000',
      },
      {
        filterType: 'MIN_NOTIONAL',
        minNotional: '0.00100000',
      },
    ],
  },
];
export const orderBook = {
  lastUpdateId: 100951632,
  bids: [['0.11312300', '1.57800000', []]],
  asks: [['0.11312300', '1.57800000', []]],
};
export const ticker = {
  symbol: 'ETHBTC',
  priceChange: '0.00546200',
  priceChangePercent: '5.073',
  weightedAvgPrice: '0.11026035',
  prevClosePrice: '0.10767300',
  lastPrice: '0.11313500',
  lastQty: '0.06100000',
  bidPrice: '0.11313500',
  bidQty: '0.00100000',
  askPrice: '0.11321600',
  askQty: '7.08100000',
  openPrice: '0.10767300',
  highPrice: '0.11411900',
  lowPrice: '0.10690000',
  volume: '108008.44000000',
  quoteVolume: '11909.04836175',
  openTime: 1517382804353,
  closeTime: 1517469204353,
  firstId: 27897964,
  lastId: 28169819,
  count: 271856,
};

export const order = {
  symbol: 'ETHBTC',
  orderId: 1740797,
  clientOrderId: '1XZTVBTGS4K1e',
  transactTime: 1514418413947,
  price: '0.00020000',
  origQty: '100.00000000',
  executedQty: '0.00000000',
  status: 'NEW',
  timeInForce: 'BTC',
  type: 'LIMIT',
  side: 'BUY',
};

export const myTrades = [
  {
    id: 9960,
    orderId: 191939,
    price: '0.00138000',
    qty: '10.00000000',
    commission: '0.00001380',
    commissionAsset: 'ETH',
    time: 1508611114735,
    isBuyer: false,
    isMaker: false,
    isBestMatch: true,
  },
];

export const aggTrades = [
  {
    aggId: 2107132,
    price: '0.05390400',
    quantity: '1.31000000',
    firstId: 2215345,
    lastId: 2215345,
    timestamp: 1508478599481,
    isBuyerMaker: true,
    wasBestPrice: true,
  },
];
