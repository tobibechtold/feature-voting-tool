import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ItemKeyLabel } from './ItemKeyLabel';

describe('ItemKeyLabel', () => {
  it('renders the formatted item key', () => {
    render(<ItemKeyLabel appKey="INTAKE" number={42} />);
    expect(screen.getByText('INTAKE-42')).toBeInTheDocument();
  });
});
