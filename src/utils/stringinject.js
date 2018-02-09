import isPlainObject from 'lodash/isPlainObject';
import isString from 'lodash/isString';
import isArray from 'lodash/isArray';

export default (str, data) => {
  if (isString(str) && isArray(data)) {
    return str.replace(
      /({\d})/g,
      i => data[i.replace(/{/, '').replace(/}/, '')],
    );
  } else if (isString(str) && isPlainObject(data)) {
    for (const key in data) {
      return str.replace(/({([^}]+)})/g, (i) => {
        const key = i.replace(/{/, '').replace(/}/, '');
        if (!data[key]) {
          return i;
        }

        return data[key];
      });
    }
  } else {
    return false;
  }
};
