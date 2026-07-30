// Dedicated Aave V3 BIL money-market pool on Hydration.
export const BIL_MONEY_MARKET_POOL_ADDRESS = '0x69310fda58c819ad82df7d2cb61841c853337a53';

// Includes its own leading space for insertion after the account marker.
export function borrowMarketFlag(address) {
  return address.toString().toLowerCase() === BIL_MONEY_MARKET_POOL_ADDRESS ? ' 🇧🇷' : '';
}
