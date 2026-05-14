// Lightweight formatters used across calculator UIs.

export function fmtUSD(n: number, opts: { compact?: boolean; cents?: boolean } = {}): string {
  if (!Number.isFinite(n)) return '—';
  if (opts.compact) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: opts.cents ? 2 : 0,
  }).format(n);
}

export function fmtUSDRange(low: number, high: number): string {
  return `${fmtUSD(low)} – ${fmtUSD(high)}`;
}

export function fmtPercent(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtMonths(months: number): string {
  if (!Number.isFinite(months) || months < 0) return '—';
  if (months >= 12) {
    const years = months / 12;
    if (years >= 100) return '100+ years';
    return `${years.toFixed(years >= 10 ? 0 : 1)} years`;
  }
  return `${months.toFixed(0)} months`;
}

export function fmtKwh(n: number): string {
  return `${Math.round(n).toLocaleString('en-US')} kWh`;
}
