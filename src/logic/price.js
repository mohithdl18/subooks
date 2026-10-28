
/**
 * SU VILLA — Centralized Pricing Configuration
 * All prices are in INR.
 *
 * Breakfast is complimentary.
 * Tax is stored for future use only and is not applied.
 */

export const PRICING = {
  // Standard accommodation rates per night
  accommodation: {
    weekday: 12999, // Monday–Thursday
    weekend: 14999, // Friday–Sunday
    peak: 15999, // Festival / peak / long weekend
  },

  // Additional guests per night
  extraGuests: {
    adult: 4000,
    child: 2000, // Child aged 6–12
    complimentaryChildMaxAge: 5, // Children aged 0–5
  },

  // Meal prices per person, per night
  meals: {
    lunch: 0,
    dinner: 0,
    lunchDinner: 0,
  },

  // Driver accommodation
  driverAccommodation: {
    perDriverPerNight: 0,
  },

  // Tax configuration — stored only, not applied
  tax: {
    rate: 0.12,
    percentage: 12,
  },
};

/**
 * Calculate additional guest charges before tax.
 */
export function calculateRoomPrice({
  basePrice = 0,
  extraAdults = 0,
  chargeableChildren = 0,
  nights = 1,
} = {}) {
  const validNights = Math.max(1, Number(nights) || 1);

  const nightlyPrice =
    Number(basePrice || 0) +
    Number(extraAdults || 0) * PRICING.extraGuests.adult +
    Number(chargeableChildren || 0) * PRICING.extraGuests.child;

  return nightlyPrice * validNights;
}

/**
 * Calculate meal costs before tax.
 */
export function calculateMealPrice({
  mealType = null,
  guests = 0,
  nights = 1,
} = {}) {
  if (!mealType || !(mealType in PRICING.meals)) {
    return 0;
  }

  return (
    PRICING.meals[mealType] *
    Math.max(0, Number(guests) || 0) *
    Math.max(1, Number(nights) || 1)
  );
}

/**
 * Calculate driver accommodation before tax.
 */
export function calculateDriverAccommodationPrice({
  drivers = 0,
  nights = 1,
} = {}) {
  return (
    Math.max(0, Number(drivers) || 0) *
    PRICING.driverAccommodation.perDriverPerNight *
    Math.max(1, Number(nights) || 1)
  );
}

/**
 * Format an amount in Indian Rupees.
 */
export function formatPrice(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}
