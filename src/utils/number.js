export const precisionFromString = (string) => {
  const split = string.replace(/0+$/g, '').split('.');

  return split.length > 1 ? split[1].length : 0;
};
