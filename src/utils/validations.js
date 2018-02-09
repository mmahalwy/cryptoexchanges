import forEach from 'lodash/forEach';
import tail from 'lodash/tail';
import xor from 'lodash/xor';

export const validateRequiredParams = ({
  name,
  params,
  error: ErrorClass = Error,
}) => {
  const errors = [];

  forEach(params, (value, paramName) => {
    if (!value) {
      errors.push(paramName);
    }
  });

  if (errors.length) {
    throw new ErrorClass(`Method ${name} requires ${errors.join(', ')} parameters`);
  }
};

export const validateSameKeys = (responses) => {
  const firstResponseKeys = Object.keys(responses[0]);
  const firstResponseLength = firstResponseKeys.length;

  tail(responses).forEach((response) => {
    const keys = Object.keys(response);

    if (keys.length !== firstResponseLength) {
      console.log(
        'There is a xor between response keys',
        xor(firstResponseKeys, keys),
      );
    }
  });
};
