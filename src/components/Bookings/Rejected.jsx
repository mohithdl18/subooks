"use client";

export default function Rejected({
  title = "Payment unsuccessful",
  message = "We could not complete or verify this payment.",
  paymentId = "",
  onRetry,
  onClose,
  retryLabel = "Return to checkout",
}) {
  return (
    <section
      className="mx-auto w-full max-w-xl rounded-2xl border border-red-200 bg-[#F7FAEE] p-5 text-[#052a50] sm:p-8"
      aria-labelledby="payment-rejected-title"
      aria-live="polite"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-700">
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
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </div>

      <div className="mt-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-700">
          Payment status
        </p>

        <h2
          id="payment-rejected-title"
          className="mt-2 text-2xl font-bold sm:text-3xl"
        >
          {title}
        </h2>

        <p className="mt-3 text-sm leading-6 text-[#052a50]/70">
          {message}
        </p>
      </div>

      {paymentId && (
        <div className="mt-6 rounded-xl border border-[#052a50]/10 bg-white p-4">
          <p className="text-xs text-[#052a50]/60">Payment reference</p>
          <p className="mt-1 break-all text-sm font-semibold">{paymentId}</p>
        </div>
      )}

      <div className="mt-5 rounded-xl border border-[#e4b441]/50 bg-white p-4">
        <p className="text-sm leading-6 text-[#052a50]/75">
          If money was deducted from your account, do not immediately pay again.
          Check your payment status or contact SU VILLA with your payment
          reference.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 rounded-xl bg-[#052a50] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#e4b441] hover:text-[#052a50]"
          >
            {retryLabel}
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[#052a50]/20 bg-white px-5 py-3.5 text-sm font-semibold text-[#052a50] transition hover:bg-[#052a50]/5"
          >
            Close
          </button>
        )}
      </div>
    </section>
  );
}
