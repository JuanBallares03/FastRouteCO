import { render, screen } from '@testing-library/react-native';
import { RejectedActionsModal } from '../RejectedActionsModal';
import type { RejectedActionItem } from '@/features/route/rejected-actions';

function item(key: string, reported: boolean): RejectedActionItem {
  return {
    key,
    ids: [key],
    title: `Entrega ${key}`,
    reason: 'Ruta no encontrada',
    rejectedAt: Date.parse('2026-11-24T16:00:00.000Z'),
    reported,
  };
}

describe('RejectedActionsModal', () => {
  it('tells the driver which actions were already reported to the supervisor', async () => {
    await render(
      <RejectedActionsModal
        visible
        items={[item('a', true), item('b', false)]}
        retryingKey={null}
        onRetry={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.getAllByText('Informado al supervisor')).toHaveLength(1);
  });
});
