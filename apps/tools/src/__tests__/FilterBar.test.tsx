import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBar } from '../components/FilterBar';

describe('FilterBar', () => {
  it('renders all filter inputs', () => {
    render(<FilterBar filters={{}} onChange={() => {}} />);

    expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/hip-hop/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/chill/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search scripts/i)).toBeInTheDocument();
  });

  it('calls onChange with updated type filter', () => {
    const onChange = vi.fn();
    render(<FilterBar filters={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'transition' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'transition', offset: 0 })
    );
  });

  it('calls onChange with genre input', () => {
    const onChange = vi.fn();
    render(<FilterBar filters={{}} onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText(/hip-hop/i), { target: { value: 'jazz' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ genre: 'jazz', offset: 0 })
    );
  });

  it('resets offset when filters change', () => {
    const onChange = vi.fn();
    render(<FilterBar filters={{ offset: 40 }} onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText(/search scripts/i), { target: { value: 'hello' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 0 })
    );
  });
});
