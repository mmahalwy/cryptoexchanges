import ExtendableError from 'es6-error';

class NotImplemented extends ExtendableError {
  constructor(message = 'Not implemented') {
    super(message);
  }
}

export default NotImplemented;
