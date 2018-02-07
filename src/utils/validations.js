import forEach from 'lodash/forEach';

// eslint-disable-next-line import/prefer-default-export
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
