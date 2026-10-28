
"use client";

import { useMemo, useState } from "react";

const COLORS = {
  background: "#F7FAEE",
  foreground: "#052a50",
  accent: "#e4b441",
  border: "rgba(5, 42, 80, 0.12)",
};

const TAX_RATE = 0.18;
const PLATFORM_FEE_RATE = 0.02;

const PROMO_CODES = {
  SUVILLA10: 10,
  WELCOME5: 5,
  STAY15: 15,
};

const ADDON_PRICES = {
  lunch: 550,
  dinner: 650,
  lunchDinner: 1100,
  driverAccommodation: 1500,
};

const MEAL_OPTIONS = [
  { id: "lunch", label: "Lunch", price: ADDON_PRICES.lunch },
  { id: "dinner", label: "Dinner", price: ADDON_PRICES.dinner },
  {
    id: "lunchDinner",
    label: "Lunch + Dinner",
    price: ADDON_PRICES.lunchDinner,
  },
];

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function getRoomName(room) {
  return room?.name || room?.title || room?.shortName || "Room";
}

function getRoomPrice(room) {
  return Math.max(0, Number(room?.price ?? room?.basePrice ?? 0));
}

function getPackageName(pkg) {
  return pkg?.name || pkg?.shortName || "Stay Package";
}

function getPackagePrice(pkg) {
  return Math.max(0, Number(pkg?.price ?? pkg?.basePrice ?? 0));
}

export default function Checkout({
  rooms = [],
  packages = [],
  addons = {},
  details = {},
  nights = 1,
  onBack,
  onPay,
  paymentMessage = "",
}) {
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoMessage, setPromoMessage] = useState("");
  const [promoError, setPromoError] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [isPaying, setIsPaying] = useState(false);
  const [localPaymentMessage, setLocalPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState(false);

  const stayNights = Math.max(1, Number(nights) || 1);

  const guestCount = Math.max(
    0,
    Number(addons.mealGuests ?? addons.totalGuests ?? 2) || 0
  );

  const roomCount = rooms.length;
  const packageCount = packages.length;
  const itemCount = roomCount + packageCount;

  const selectedMeal = MEAL_OPTIONS.find(
    (meal) => meal.id === addons.mealPlan
  );

  const selectedDriverMeal = MEAL_OPTIONS.find(
    (meal) => meal.id === addons.driverMealPlan
  );

  const mealGuests = Math.max(0, Number(addons.mealGuests) || 0);
  const driverCount = Math.max(0, Number(addons.drivers) || 0);

  const roomLines = useMemo(
    () =>
      rooms.map((room) => {
        const total = Math.max(
          0,
          Number(
            room.totalPrice ??
              getRoomPrice(room) *
                Math.max(1, Number(room.nights) || stayNights)
          ) || 0
        );

        return {
          id: room.id,
          name: getRoomName(room),
          quantity: stayNights,
          unitPrice: total / stayNights,
          total,
        };
      }),
    [rooms, stayNights]
  );

  const packageLines = useMemo(
    () =>
      packages.map((pkg) => {
        const total = Math.max(
          0,
          Number(pkg.totalPrice ?? getPackagePrice(pkg) * stayNights) || 0
        );

        return {
          id: pkg.id,
          name: getPackageName(pkg),
          quantity: stayNights,
          unitPrice: total / stayNights,
          total,
        };
      }),
    [packages, stayNights]
  );

  const roomSubtotal = roomLines.reduce(
    (sum, line) => sum + line.total,
    0
  );

  const packageSubtotal = packageLines.reduce(
    (sum, line) => sum + line.total,
    0
  );

  const mealTotal = selectedMeal
    ? selectedMeal.price * mealGuests * stayNights
    : 0;

  const driverAccommodationTotal =
    driverCount * ADDON_PRICES.driverAccommodation * stayNights;

  const driverMealTotal = selectedDriverMeal
    ? selectedDriverMeal.price * driverCount * stayNights
    : 0;

  const calculatedAddonsTotal =
    mealTotal + driverAccommodationTotal + driverMealTotal;

  const addonsTotal =
    addons.totalAddons !== undefined && addons.totalAddons !== null
      ? Math.max(0, Number(addons.totalAddons) || 0)
      : calculatedAddonsTotal;

  const subtotal = roomSubtotal + packageSubtotal + addonsTotal;

  const discountRate = appliedPromo
    ? appliedPromo.discount / 100
    : 0;

  const discountAmount = Math.min(
    subtotal,
    Math.round(subtotal * discountRate * 100) / 100
  );

  // Apply the discount before calculating tax and platform fee.
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);

  const taxAmount =
    Math.round(discountedSubtotal * TAX_RATE * 100) / 100;

  const platformFee =
    Math.round(discountedSubtotal * PLATFORM_FEE_RATE * 100) / 100;

  const totalAmount =
    Math.round(
      (discountedSubtotal + taxAmount + platformFee) * 100
    ) / 100;

  function applyPromoCode(event) {
    event.preventDefault();

    const code = promoInput.trim().toUpperCase();

    if (!code) {
      setAppliedPromo(null);
      setPromoError(true);
      setPromoMessage("Please enter a promo code.");
      return;
    }

    const discount = PROMO_CODES[code];

    if (!discount) {
      setAppliedPromo(null);
      setPromoError(true);
      setPromoMessage("Invalid promo code.");
      return;
    }

    setAppliedPromo({ code, discount });
    setPromoError(false);
    setPromoMessage(`${discount}% discount applied successfully.`);
    setLocalPaymentMessage("");
  }

  function removePromoCode() {
    setAppliedPromo(null);
    setPromoInput("");
    setPromoMessage("");
    setPromoError(false);
    setLocalPaymentMessage("");
  }

  async function handlePay() {
    if (isPaying || !acceptedTerms || itemCount === 0) {
      return;
    }

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      setPaymentError(true);
      setLocalPaymentMessage(
        "The payment amount is invalid. Please review your booking."
      );
      return;
    }

    if (typeof onPay !== "function") {
      setPaymentError(true);
      setLocalPaymentMessage(
        "Payment could not be started. Please try again."
      );
      return;
    }

    setIsPaying(true);
    setPaymentError(false);
    setLocalPaymentMessage("Preparing your secure payment...");

    try {
      const paymentData = {
        customer: details,
        rooms,
        packages,
        addons,

        promoCode: appliedPromo?.code || null,
        discountPercentage: appliedPromo?.discount || 0,

        // These values are for the UI summary only.
        // The server must independently calculate the payable amount.
        subtotal,
        discountAmount,
        discountedSubtotal,
        taxRate: TAX_RATE,
        taxAmount,
        platformFeeRate: PLATFORM_FEE_RATE,
        platformFee,
        totalAmount: Number(totalAmount.toFixed(2)),

        nights: stayNights,
        totalGuests: guestCount,
        totalRooms: roomCount,
        totalPackages: packageCount,

        acceptedTerms: true,
        acceptedTermsAt: new Date().toISOString(),
        termsVersion: "1.0",
      };

      const result = await onPay(paymentData);

      if (result?.success === false) {
        setPaymentError(true);
        setLocalPaymentMessage(
          result.message ||
            "Payment could not be completed. Please try again."
        );
        return;
      }

      if (result?.pending) {
        setPaymentError(false);
        setLocalPaymentMessage(
          result.message ||
            "Your payment is being verified. Please wait before trying again."
        );
        return;
      }

      setPaymentError(false);
      setLocalPaymentMessage(
        result?.message ||
          "Continue with the secure payment window."
      );
    } catch (error) {
      console.error("Checkout payment error:", error);

      setPaymentError(true);
      setLocalPaymentMessage(
        "We couldn't start the payment. If you were already charged, contact us before making another payment."
      );
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <div
      className="space-y-6 text-[#052a50]"
      style={{
        backgroundColor: COLORS.background,
        color: COLORS.foreground,
      }}
    >
      {/* Heading */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b08a28]">
          Final step
        </p>

        <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
          Checkout
        </h2>

        <p className="mt-2 text-sm leading-6 text-[#052a50]/65">
          Review your booking details and final payable amount.
        </p>
      </section>

      {/* Promo code */}
      <section className="rounded-2xl border border-[#e4b441]/50 bg-white p-4 sm:p-5">
        <h3 className="font-semibold">Have a promo code?</h3>

        <p className="mt-1 text-sm text-[#052a50]/60">
          Apply your discount before taxes and platform fees.
        </p>

        {appliedPromo ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 p-3">
            <div>
              <p className="font-semibold text-green-800">
                {appliedPromo.code}
              </p>

              <p className="text-sm text-green-700">
                {appliedPromo.discount}% discount applied
              </p>
            </div>

            <button
              type="button"
              onClick={removePromoCode}
              disabled={isPaying}
              className="rounded-lg border border-green-300 px-3 py-2 text-sm font-semibold text-green-800 transition hover:bg-green-100 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ) : (
          <form
            onSubmit={applyPromoCode}
            className="mt-4 flex flex-col gap-2 sm:flex-row"
          >
            <input
              type="text"
              value={promoInput}
              onChange={(event) => {
                setPromoInput(event.target.value);
                setPromoMessage("");
                setPromoError(false);
              }}
              placeholder="Enter promo code"
              aria-label="Promo code"
              disabled={isPaying}
              className="min-w-0 flex-1 rounded-xl border border-[#052a50]/15 bg-[#F7FAEE] px-4 py-3 text-sm uppercase outline-none transition placeholder:normal-case placeholder:text-[#052a50]/40 focus:border-[#e4b441] disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={isPaying}
              className="rounded-xl bg-[#052a50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#e4b441] hover:text-[#052a50] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Apply Code
            </button>
          </form>
        )}

        {promoMessage && (
          <p
            role="status"
            className={`mt-3 text-sm ${
              promoError ? "text-red-600" : "text-green-700"
            }`}
          >
            {promoMessage}
          </p>
        )}

        <p className="mt-3 text-xs text-[#052a50]/45">
          Test codes: SUVILLA10, WELCOME5, STAY15
        </p>
      </section>

      {/* Customer summary */}
      <section className="rounded-2xl border border-[#052a50]/10 bg-white p-4 sm:p-5">
        <h3 className="font-semibold">Guest information</h3>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-[#052a50]/55">Booking under</p>
            <p className="mt-1 break-words font-semibold">
              {details.name || "Guest"}
            </p>
          </div>

          <div>
            <p className="text-xs text-[#052a50]/55">Total guests</p>
            <p className="mt-1 font-semibold">
              {guestCount} {guestCount === 1 ? "guest" : "guests"}
            </p>
          </div>

          <div>
            <p className="text-xs text-[#052a50]/55">Selected items</p>
            <p className="mt-1 font-semibold">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </p>

            {roomCount > 0 && (
              <p className="mt-1 text-xs text-[#052a50]/55">
                {roomCount} {roomCount === 1 ? "room" : "rooms"}
              </p>
            )}

            {packageCount > 0 && (
              <p className="mt-1 text-xs text-[#052a50]/55">
                {packageCount}{" "}
                {packageCount === 1 ? "package" : "packages"}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-[#052a50]/10 pt-4">
          <p className="text-xs text-[#052a50]/55">Stay duration</p>
          <p className="mt-1 font-semibold">
            {stayNights} {stayNights === 1 ? "night" : "nights"}
          </p>
        </div>
      </section>

      {/* Itemized booking */}
      <section className="rounded-2xl border border-[#052a50]/10 bg-white p-4 sm:p-5">
        <h3 className="font-semibold">Price breakdown</h3>

        <div className="mt-4 space-y-4">
          {roomLines.map((line) => (
            <div
              key={`room-${line.id}`}
              className="flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{line.name}</p>
                <p className="mt-1 text-xs text-[#052a50]/55">
                  {formatPrice(line.unitPrice)} × {line.quantity}{" "}
                  {line.quantity === 1 ? "night" : "nights"}
                </p>
              </div>

              <p className="shrink-0 text-right text-sm font-semibold">
                {formatPrice(line.total)}
              </p>
            </div>
          ))}

          {packageLines.map((line) => (
            <div
              key={`package-${line.id}`}
              className="flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{line.name}</p>
                <p className="mt-1 text-xs text-[#052a50]/55">
                  {formatPrice(line.unitPrice)} × {line.quantity}{" "}
                  {line.quantity === 1 ? "night" : "nights"}
                </p>
              </div>

              <p className="shrink-0 text-right text-sm font-semibold">
                {formatPrice(line.total)}
              </p>
            </div>
          ))}

          {roomLines.length === 0 && packageLines.length === 0 && (
            <p className="text-sm text-[#052a50]/60">
              No rooms or packages were provided for this checkout.
            </p>
          )}

          <div className="border-t border-[#052a50]/10 pt-4">
            <p className="mb-3 text-sm font-semibold">Add-ons</p>

            {selectedMeal && (
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm">{selectedMeal.label}</p>
                  <p className="mt-1 text-xs text-[#052a50]/55">
                    {formatPrice(selectedMeal.price)} × {mealGuests} guests ×{" "}
                    {stayNights} {stayNights === 1 ? "night" : "nights"}
                  </p>
                </div>

                <p className="shrink-0 text-sm">
                  {formatPrice(mealTotal)}
                </p>
              </div>
            )}

            {driverCount > 0 && (
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm">Driver accommodation</p>
                  <p className="mt-1 text-xs text-[#052a50]/55">
                    {formatPrice(ADDON_PRICES.driverAccommodation)} ×{" "}
                    {driverCount} drivers × {stayNights}{" "}
                    {stayNights === 1 ? "night" : "nights"}
                  </p>
                </div>

                <p className="shrink-0 text-sm">
                  {formatPrice(driverAccommodationTotal)}
                </p>
              </div>
            )}

            {selectedDriverMeal && driverCount > 0 && (
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm">
                    Driver {selectedDriverMeal.label.toLowerCase()}
                  </p>
                  <p className="mt-1 text-xs text-[#052a50]/55">
                    {formatPrice(selectedDriverMeal.price)} × {driverCount}{" "}
                    drivers × {stayNights}{" "}
                    {stayNights === 1 ? "night" : "nights"}
                  </p>
                </div>

                <p className="shrink-0 text-sm">
                  {formatPrice(driverMealTotal)}
                </p>
              </div>
            )}

            {addonsTotal === 0 && (
              <p className="text-sm text-[#052a50]/55">
                No paid add-ons selected.
              </p>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-[#052a50]/10 pt-3 text-sm font-semibold">
              <span>Total add-ons</span>
              <span>{formatPrice(addonsTotal)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Totals */}
      <section className="rounded-2xl border border-[#052a50]/10 bg-white p-4 sm:p-5">
        <h3 className="font-semibold">Payment summary</h3>

        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#052a50]/70">Subtotal</span>
            <span className="font-medium">{formatPrice(subtotal)}</span>
          </div>

          {appliedPromo && (
            <div className="flex items-center justify-between gap-4 text-green-700">
              <span>Promo discount ({appliedPromo.discount}%)</span>
              <span className="font-medium">
                − {formatPrice(discountAmount)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <span className="text-[#052a50]/70">Tax (18%)</span>
            <span className="font-medium">{formatPrice(taxAmount)}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-[#052a50]/70">Platform fee (2%)</span>
            <span className="font-medium">{formatPrice(platformFee)}</span>
          </div>

          <div className="mt-4 border-t border-[#052a50]/15 pt-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-semibold">Total amount</p>
                <p className="mt-1 text-xs text-[#052a50]/55">
                  Including discount, tax and platform fee
                </p>
              </div>

              <p className="text-xl font-bold sm:text-2xl">
                {formatPrice(totalAmount)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Payment status */}
      {(localPaymentMessage || paymentMessage) && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl border p-4 text-sm leading-6 ${
            paymentError
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-[#e4b441]/60 bg-white text-[#052a50]"
          }`}
        >
          {localPaymentMessage || paymentMessage}
        </div>
      )}

      {/* Terms and Conditions */}
      <section className="rounded-2xl border border-[#052a50]/10 bg-white p-4 sm:p-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={acceptedTerms}
            disabled={isPaying}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#052a50]"
          />

          <span className="text-sm leading-6 text-[#052a50]/80">
            I have read and agree to the{" "}
            <a
              href="/terms-and-conditions"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#052a50] underline underline-offset-4 transition hover:text-[#B34325]"
            >
              Terms and Conditions
            </a>
            . I understand that my booking is subject to the stated
            policies.
          </span>
        </label>

        {!acceptedTerms && (
          <p className="mt-3 text-xs text-[#052a50]/55">
            Please accept the Terms and Conditions to continue to payment.
          </p>
        )}
      </section>

      {/* Navigation */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          disabled={isPaying}
          className="flex-1 rounded-xl border border-[#052a50]/20 bg-white px-5 py-3.5 text-sm font-semibold text-[#052a50] transition hover:bg-[#052a50]/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Back
        </button>

        <button
          type="button"
          onClick={handlePay}
          disabled={!acceptedTerms || itemCount === 0 || isPaying}
          aria-busy={isPaying}
          className={`flex-1 rounded-xl px-5 py-3.5 text-sm font-semibold transition ${
            acceptedTerms && itemCount > 0 && !isPaying
              ? "bg-[#052a50] text-white hover:bg-[#e4b441] hover:text-[#052a50]"
              : "cursor-not-allowed bg-gray-300 text-gray-500"
          }`}
        >
          {isPaying
            ? "Preparing Payment..."
            : !acceptedTerms
              ? "Accept Terms to Pay"
              : `Pay ${formatPrice(totalAmount)}`}
        </button>
      </div>
    </div>
  );
}
