import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppKeyField } from './AppKeyField';

describe('AppKeyField', () => {
  it('uppercases typed input before calling onChange', () => {
    const onChange = vi.fn();
    render(<AppKeyField value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'intake' } });
    expect(onChange).toHaveBeenCalledWith('INTAKE');
  });

  it('shows an example key built from the value', () => {
    render(<AppKeyField value="INTAKE" onChange={() => {}} />);
    expect(screen.getByText('Example: INTAKE-42')).toBeInTheDocument();
  });

  it('shows a placeholder example when empty', () => {
    render(<AppKeyField value="" onChange={() => {}} />);
    expect(screen.getByText('Example: KEY-42')).toBeInTheDocument();
  });

  it('renders the error text when given', () => {
    render(<AppKeyField value="X" onChange={() => {}} error="Bad key" />);
    expect(screen.getByText('Bad key')).toBeInTheDocument();
  });
});
