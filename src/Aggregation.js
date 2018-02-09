class Aggregation {
  constructor({ exchanges = [] } = {}) {
    this.exchanges = exchanges;
  }

  reduceResponses = (responses) => {
    responses.reduce((total, response, index) => {
      const exchangeName = this.exchanges[index].constructor.name.toLowerCase();

      return {
        ...total,
        [exchangeName]: response,
      };
    }, {});
  };

  async fetchBalance() {
    const promises = this.exchanges.map(exchange => exchange.fetchBalance());

    const responses = await Promise.all(promises);

    return this.reduceResponses(responses);
  }
}

export default Aggregation;
