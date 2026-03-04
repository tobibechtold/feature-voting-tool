import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReleaseTargetBadges } from './ReleaseTargetBadges';

const targets = [
  { id: 't1', platform: 'ios', semver: '1.2.3' },
  { id: 't2', platform: 'android', semver: '1.2.3' },
];

describe('ReleaseTargetBadges', () => {
  it('shows remove buttons for admins and calls onRemove with target id', () => {
    const onRemove = vi.fn();

    render(
      <ReleaseTargetBadges
        targets={targets}
        isAdmin
        isRemoving={false}
        label="Included in version"
        onRemove={onRemove}
      />
    );

    const removeButtons = screen.getAllByRole('button', { name: /remove version target/i });
    expect(removeButtons).toHaveLength(2);

    fireEvent.click(removeButtons[1]);
    expect(onRemove).toHaveBeenCalledWith('t2');
  });

  it('hides remove buttons for non-admin users', () => {
    const onRemove = vi.fn();

    render(
      <ReleaseTargetBadges
        targets={targets}
        isAdmin={false}
        isRemoving={false}
        label="Included in version"
        onRemove={onRemove}
      />
    );

    expect(screen.queryByRole('button', { name: /remove version target/i })).toBeNull();
  });
});
