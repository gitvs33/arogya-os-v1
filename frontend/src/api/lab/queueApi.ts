import client from '../client';

export const labQueueApi = {
  /** Get the lab queue grouped by priority. */
  getQueue: () => client.get('/lab-queue/'),

  /** Mark all samples for a patient as collected. */
  collectSamples: (groupId: string) =>
    client.post('/lab-queue/collect-samples/', { group_id: groupId }),

  /** Mark a single lab order as received in lab. */
  receiveInLab: (orderId: string) =>
    client.post('/lab-queue/receive-in-lab/', { order_id: orderId }),
};
