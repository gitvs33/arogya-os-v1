import client from './client';

export const dashboardApi = {
  stats: () => client.get('/dashboard/'),
};
