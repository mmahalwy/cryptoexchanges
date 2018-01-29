export const validateParams = (name, payload, requires = []) => {
  if (!payload) {
    throw new Error('You need to pass a payload object.');
  }

  requires.forEach((r) => {
    if (!payload[r] && isNaN(payload[r])) {
      throw new Error(`Method ${name} requires ${r} parameter.`);
    }
  });

  return true;
};
