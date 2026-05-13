/**
 * Site-wide feature flags. Single source of truth so toggling a
 * processor on or off only requires flipping one constant, not
 * chasing every if-branch across the codebase.
 */

/**
 * Mentom Payments (PaymentCloud / NMI) is fully disabled.
 *
 * The merchant account was cancelled on the PaymentCloud side. Every
 * new pledge, marketplace purchase, balance payment, and retry that
 * would have routed through Mentom now refuses up front. Existing
 * NMI pledge data remains in the database (Flying Sparks, etc.) and
 * still renders in admin transactions, creator IndieKit history, and
 * receipt views — disabling the rail does NOT touch historical
 * records.
 *
 * To re-enable: flip this to false. Every gate in the codebase that
 * blocks the rail is keyed off this constant; nothing else needs to
 * change.
 */
export const NMI_DISABLED = true;

/**
 * Helper for the "rail temporarily unavailable" message we surface to
 * a user who lands on a creator's project that's still configured to
 * use Mentom. Centralized so the wording stays consistent.
 */
export const NMI_DISABLED_MESSAGE =
  "Card payments on this project are temporarily unavailable while we switch processors. Please check back shortly or contact support.";
