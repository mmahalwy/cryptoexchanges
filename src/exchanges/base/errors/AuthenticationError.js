import ExtendableError from 'es6-error';

class AuthenticationError extends ExtendableError {
  constructor(message = 'Not implemented') {
    super(message);
  }
}

export default AuthenticationError;
