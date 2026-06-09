import client from './client';

export const ddiApi = {
  check: (drugs) => client.post('/api/ddi/check/', { drugs }),
};
