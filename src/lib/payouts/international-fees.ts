// International wire transfer surcharges applied on creator payouts to
// non-US bank accounts. The flat fee covers the SWIFT correspondent
// bank charge; the percentage covers the FX spread on USD → local
// currency conversion. Domestic ACH/Faster Payments rails don't carry
// either cost so US banks pay nothing extra here.
export const INTERNATIONAL_WIRE_FEE_USD = 25;
export const INTERNATIONAL_CURRENCY_CONVERSION_RATE = 0.015; // 1.5%

export interface InternationalFees {
  bankCountry: string;
  isInternational: boolean;
  wireFee: number;
  currencyConversionFee: number;
  totalInternationalFees: number;
}

// `subtotalBeforeWireFees` is what the creator would receive after
// platform + processor fees but before any wire/FX charges. The CC
// fee is computed off that subtotal so we don't double-charge the
// platform cut on the FX margin.
export function calculateInternationalFees(
  bankCountry: string | null | undefined,
  subtotalBeforeWireFees: number,
): InternationalFees {
  const country = (bankCountry || "US").toUpperCase();
  const isInternational = country !== "US";

  const wireFee = isInternational ? INTERNATIONAL_WIRE_FEE_USD : 0;
  const currencyConversionFee = isInternational
    ? Math.round(subtotalBeforeWireFees * INTERNATIONAL_CURRENCY_CONVERSION_RATE * 100) / 100
    : 0;
  const totalInternationalFees = Math.round((wireFee + currencyConversionFee) * 100) / 100;

  return {
    bankCountry: country,
    isInternational,
    wireFee,
    currencyConversionFee,
    totalInternationalFees,
  };
}
