import ExtendableError from 'es6-error';

class NotSupported extends ExtendableError {
  constructor(message = 'Not implemented') {
    super(message);
  }
}

export default NotSupported;
