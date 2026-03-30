import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsBar } from '../components/StatsBar';

describe('StatsBar', () => {
  it('shows loading when stats is null', () => {
    render(<StatsBar stats={null} />);
    expect(screen.getByText('Loading stats...')).toBeInTheDocument();
  });

  it('displays total, avg quality, and duration', () => {
    render(
      <StatsBar
        stats={{
          total: 42,
          by_type: { transition: 10, show_intro: 5 },
          avg_quality: 0.756,
          total_duration_ms: 125000,
        }}
      />
    );

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('0.76')).toBeInTheDocument();
    expect(screen.getByText('2m')).toBeInTheDocument();
  });

  it('displays type breakdown', () => {
    render(
      <StatsBar
        stats={{
          total: 10,
          by_type: { transition: 7, ad_lib: 3 },
          avg_quality: 0.5,
          total_duration_ms: 60000,
        }}
      />
    );

    expect(screen.getByText('transition')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('ad lib')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
