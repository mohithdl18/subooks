"use client";

import { useEffect } from "react";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function Confirmation({
  booking = null,
  customer = {},
  checkIn = "",
  checkOut = "",
  nights = 1,
  amount = null,
  onClose,
  onDone,
}) {
  const bookingId =
    booking?.bookingId ||
    booking?.BookingID ||
    booking?.booking_id ||
    booking?._id ||
    "";

  const paymentId =
    booking?.paymentId ||
    booking?.razorpay_payment_id ||
    booking?.payment_id ||
    "";

  const displayAmount =
    amount ??
    booking?.totalAmount ??
    booking?.amount ??
    booking?.pricing?.totalAmount ??
    null;

  const money = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);

  const close = onDone || onClose;

  useEffect(() => {
    // Intentionally no automatic redirect: the guest should be able
    // to read and retain their booking confirmation details.
  }, []);

  return (
    <section
      className="mx-auto w-full max-w-xl rounded-2xl border border-green-200 bg-[#F7FAEE] p-5 text-[#052a50] sm:p-8"
      aria-labelledby="booking-confirmation-title"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8"
          aria-hidden="true"
        >
          <path d="m5 12 4 4L19 6" />
        </svg>
      </div>

      <div className="mt-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-green-700">
          Payment verified
        </p>

        <h2
          id="booking-confirmation-title"
          className="mt-2 text-2xl font-bold sm:text-3xl"
        >
          Booking confirmed!
        </h2>

        <p className="mt-3 text-sm leading-6 text-[#052a50]/70">
          Thank you{customer?.name ? `, ${customer.name}` : ""}. Your payment
          has been verified and your booking has been confirmed.
        </p>
      </div>

      {bookingId && (
        <div className="mt-6 rounded-xl border border-green-200 bg-white p-4 text-center">
          <p className="text-xs text-[#052a50]/60">Booking reference</p>
          <p className="mt-1 break-all text-lg font-bold">{String(bookingId)}</p>
        </div>
      )}

      <div className="mt-6 space-y-4 rounded-xl border border-[#052a50]/10 bg-white p-4">
        {(checkIn || booking?.checkIn || booking?.CheckIN) && (
          <div className="flex items-start justify-between gap-4">
            <span className="text-sm text-[#052a50]/60">Check-in</span>
            <span className="text-right text-sm font-semibold">
              {formatDate(checkIn || booking?.checkIn || booking?.CheckIN)}
            </span>
          </div>
        )}

        {(checkOut || booking?.checkOut || booking?.CheckOUT) && (
          <div className="flex items-start justify-between gap-4">
            <span className="text-sm text-[#052a50]/60">Check-out</span>
            <span className="text-right text-sm font-semibold">
              {formatDate(checkOut || booking?.checkOut || booking?.CheckOUT)}
            </span>
          </div>
        )}

        {nights && (
          <div className="flex items-start justify-between gap-4">
            <span className="text-sm text-[#052a50]/60">Duration</span>
            <span className="text-right text-sm font-semibold">
              {nights} {Number(nights) === 1 ? "night" : "nights"}
            </span>
          </div>
        )}

        {displayAmount !== null && displayAmount !== undefined && (
          <div className="flex items-start justify-between gap-4 border-t border-[#052a50]/10 pt-4">
            <span className="text-sm text-[#052a50]/60">Amount paid</span>
            <span className="text-right text-sm font-bold">
              {money(displayAmount)}
            </span>
          </div>
        )}

        {paymentId && (
          <div className="border-t border-[#052a50]/10 pt-4">
            <p className="text-xs text-[#052a50]/60">Payment reference</p>
            <p className="mt-1 break-all text-sm font-medium">{String(paymentId)}</p>
          </div>
        )}
      </div>

      {customer?.email && (
        <p className="mt-4 text-center text-sm leading-6 text-[#052a50]/65">
          Booking updates can be sent to <strong>{customer.email}</strong>.
        </p>
      )}

      <p className="mt-4 text-center text-xs leading-5 text-[#052a50]/55">
        Please keep your booking reference for future communication with SU VILLA.
      </p>

      {close && (
        <button
          type="button"
          onClick={close}
          className="mt-6 w-full rounded-xl bg-[#052a50] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#e4b441] hover:text-[#052a50]"
        >
          Done
        </button>
      )}
    </section>
  );
}
