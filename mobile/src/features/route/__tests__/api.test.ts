import { routesApi } from '../api';
import { api } from '@/services/http';

jest.mock('@/services/http', () => ({
  api: { post: jest.fn() },
}));

const post = jest.mocked(api.post);

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue({ data: { id: 'r1' } });
});

describe('routesApi.startRoute', () => {
  it('sends the offline start time as an ISO string', async () => {
    await routesApi.startRoute(
      'r1',
      { latitude: 4.4389, longitude: -75.2322 },
      '2026-11-23T13:05:00.000Z'
    );

    expect(post).toHaveBeenCalledWith('/routes/driver/r1/start', {
      latitude: 4.4389,
      longitude: -75.2322,
      capturedAt: '2026-11-23T13:05:00.000Z',
    });
  });

  it('omits capturedAt for an online start', async () => {
    await routesApi.startRoute('r1');

    expect(post).toHaveBeenCalledWith('/routes/driver/r1/start', {});
  });
});
