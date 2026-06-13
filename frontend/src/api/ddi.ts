import client from './client';

export const ddiApi = {
  check: (drugs) => client.post('/ddi/check/', { drugs }),
};
