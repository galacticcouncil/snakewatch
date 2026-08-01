// Pure backing math, kept dependency-free so it is trivially unit-testable and
// importable without pulling in the block/discord/metrics runtime.

/** Floor a raw integer amount to NTT precision (8 dp) so amounts across chains/decimals are comparable. */
export function normalizeTo8dp(raw, decimals) {
  const v = BigInt(raw);
  if (decimals > 8) return v / 10n ** BigInt(decimals - 8);
  if (decimals < 8) return v * 10n ** BigInt(8 - decimals);
  return v;
}

/** Assess backing from 8-dp-normalized custody + issuance. threshold >= 1 requires an over-collateralisation buffer. */
export function assessBacking(issuance8, custody8, threshold = 1) {
  const shortfall8 = issuance8 > custody8 ? issuance8 - custody8 : 0n;
  const ratio = issuance8 === 0n ? Infinity : Number(custody8) / Number(issuance8);
  const sufficient = issuance8 === 0n ? true : ratio >= threshold;
  return {ratio, shortfall8, sufficient};
}
