import ExtendableError from 'es6-error';

class ExchangeError extends ExtendableError {
  constructor(message = 'Not implemented') {
    super(message);
  }
}

export default ExchangeError;
