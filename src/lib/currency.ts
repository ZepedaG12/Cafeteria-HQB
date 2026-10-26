/**
 * Formatea montos en Lempiras hondureños (HNL -> L 0.00)
 */
export function formatLempira(amount: number, decimals = 2): string {
  const num = Number(amount) || 0;
  const absFormatted = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return num < 0 ? `-L ${absFormatted}` : `L ${absFormatted}`;
}
