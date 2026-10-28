"use client";

import { useState } from "react";
import { getAvailablePackages } from "@/logic/packageAvailability";
import {
  PRICING,
  calculateRoomPrice,
  formatPrice,
} from "@/logic/price";
import Modal from "@/components/Bookings/Modal";
import Addons from "@/components/Bookings/Addons";
import Checkout from "@/components/Bookings/Checkout";
import Confirmation from "@/components/Bookings/Confirmation";
import Rejected from "@/components/Bookings/Rejected";

const RAZORPAY_SCRIPT_URL =
  "https://checkout.razorpay.com/v1/checkout.js";

function getStoredBookingContext() {
  const context = {
    TempID: "",
    CheckIN: "",
    CheckOUT: "",
  };

  if (typeof window === "undefined") {
    return context;
  }

  // Look through session storage for the booking object.
  // Explicit props passed to Cart take priority over these values.
  try {
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (!key) continue;

      const rawValue = window.sessionStorage.getItem(key);
      if (!rawValue) continue;

      let parsed;

      try {
        parsed = JSON.parse(rawValue);
      } catch {
        parsed = rawValue;
      }

      if (typeof parsed === "string") {
        const normalizedKey = key.toLowerCase();

        if (
          normalizedKey.includes("tempid") ||
          normalizedKey.includes("temp_id")
        ) {
          context.TempID ||= parsed;
        }

        if (
          normalizedKey.includes("checkin") ||
          normalizedKey.includes("check_in")
        ) {
          context.CheckIN ||= parsed;
        }

        if (
          normalizedKey.includes("checkout") ||
          normalizedKey.includes("check_out")
        ) {
          context.CheckOUT ||= parsed;
        }

        continue;
      }

      if (!parsed || typeof parsed !== "object") continue;

      const candidate =
        parsed.bookingData ||
        parsed.booking ||
        parsed.data ||
        parsed;

      context.TempID ||= candidate.TempID || candidate.tempID || "";
      context.CheckIN ||=
        candidate.CheckIN || candidate.checkIn || candidate.checkin || "";
      context.CheckOUT ||=
        candidate.CheckOUT || candidate.checkOut || candidate.checkout || "";

      // Also support a nested object used by booking data stores.
      if (candidate.booking && typeof candidate.booking === "object") {
        context.TempID ||= candidate.booking.TempID || "";
        context.CheckIN ||=
          candidate.booking.CheckIN || candidate.booking.checkIn || "";
        context.CheckOUT ||=
          candidate.booking.CheckOUT || candidate.booking.checkOut || "";
      }
    }
  } catch (error) {
    console.error("Unable to read booking session:", error);
  }

  return context;
}

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Payments can only be started in the browser."));
      return;
    }

    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector(
      `script[src="${RAZORPAY_SCRIPT_URL}"]`
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true), {
        once: true,
      });

      existingScript.addEventListener(
        "error",
        () => reject(new Error("Unable to load the payment gateway.")),
        { once: true }
      );

      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;

    script.onload = () => resolve(true);
    script.onerror = () =>
      reject(new Error("Unable to load the payment gateway."));

    document.body.appendChild(script);
  });
}

function getDateOnly(value) {
  if (!value) return "";

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  return "";
}

export default function Cart({
  selectedRoomIds = [],
  selectedRoomData = [],
  selectedPackageIds = [],
  availableRoomIds = null,
  nights = 1,
  onClear,

  // Pass these directly from your booking-data state when available.
  tempID: providedTempID = "",
  checkIn: providedCheckIn = "",
  checkOut: providedCheckOut = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState("cart");

  const [addons, setAddons] = useState({
    mealPlan: "",
    mealGuests: 2,
    drivers: 0,
    driverMealPlan: "",
  });

  const [customerDetails, setCustomerDetails] = useState({});
  const [paymentMessage, setPaymentMessage] = useState("");
  const [isPaymentStarting, setIsPaymentStarting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  const selectedRooms = selectedRoomData.filter((room) =>
    selectedRoomIds.includes(room.id)
  );

  const availablePackages = getAvailablePackages(availableRoomIds);

  const selectedPackages = availablePackages.filter((pkg) =>
    selectedPackageIds.includes(pkg.id)
  );

  const itemCount = selectedRooms.length + selectedPackages.length;
  const stayNights = Math.max(1, Number(nights) || 1);

  function resetAddons() {
    setAddons({
      mealPlan: "",
      mealGuests: 2,
      drivers: 0,
      driverMealPlan: "",
    });
  }

  function handleClear() {
    if (isPaymentStarting) return;

    onClear?.();
    resetAddons();
    setCustomerDetails({});
    setPaymentMessage("");
    setConfirmedBooking(null);
    setStep("cart");
  }

  function handleClose() {
    // Don't close the modal while the order is being created.
    if (isPaymentStarting) return;

    setIsOpen(false);

    // Preserve confirmation and pending status if the customer closes
    // the modal; reset only the earlier cart steps.
    if (["cart", "addons", "checkout"].includes(step)) {
      setStep("cart");
    }
  }

  function handleAddonsNext(result) {
    const nextAddons = result?.addons ?? addons;
    const nextDetails = result?.details ?? {};

    setAddons(nextAddons);
    setCustomerDetails(nextDetails);
    setPaymentMessage("");
    setStep("checkout");
  }

  function handleDetailsNext(details) {
    setCustomerDetails(details);
    setPaymentMessage("");
    setStep("checkout");
  }

  async function handlePay(paymentData) {
    if (isPaymentStarting) {
      return { success: false, message: "Payment is already being prepared." };
    }

    if (!paymentData?.acceptedTerms) {
      return {
        success: false,
        message: "Please accept the Terms and Conditions.",
      };
    }

    if (selectedPackages.length > 0) {
      const message =
        "Package payments are not enabled in the current payment API. Please select individual rooms or update the server-side pricing and payment routes to support packages.";

      setPaymentMessage(message);

      return {
        success: false,
        message,
      };
    }

    if (selectedRooms.length === 0) {
      return {
        success: false,
        message: "Please select at least one room.",
      };
    }

    setIsPaymentStarting(true);
    setPaymentMessage("Checking your booking and preparing payment...");

    try {
      const storedContext = getStoredBookingContext();

      const TempID = providedTempID || storedContext.TempID;
      const checkIn = getDateOnly(
        providedCheckIn || storedContext.CheckIN
      );
      const checkOut = getDateOnly(
        providedCheckOut || storedContext.CheckOUT
      );

      if (!TempID || !checkIn || !checkOut) {
        throw new Error(
          "Your temporary booking ID or stay dates are missing. Please return to the booking calendar and select your dates again."
        );
      }

      if (checkOut <= checkIn) {
        throw new Error("Your check-out date must be after check-in.");
      }

      const roomSelections = selectedRooms.map((room) => ({
        roomId: room.id,
        extraAdults: Math.max(0, Number(room.extraAdults) || 0),
        extraChildren: Math.max(0, Number(room.extraChildren) || 0),
      }));

      const orderPayload = {
        TempID,
        checkIn,
        checkOut,
        roomSelections,
        addons: {
          mealPlan: addons.mealPlan || "",
          mealGuests: Math.max(
            0,
            Number(addons.mealGuests) || 0
          ),
          drivers: Math.max(0, Number(addons.drivers) || 0),
          driverMealPlan: addons.driverMealPlan || "",
        },
        details: {
          name: customerDetails.name || "",
          email: customerDetails.email || "",
          phone: customerDetails.phone || "",
          address: customerDetails.address || "",
          city: customerDetails.city || "",
          pincode: customerDetails.pincode || "",
          specialRequest: customerDetails.specialRequest || "",
        },
        promoCode: paymentData.promoCode || null,
      };

      // Create the order on the server. The server must calculate
      // the authoritative price and validate the active room holds.
      const orderResponse = await fetch(
        "/api/payments/create-order",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(orderPayload),
        }
      );

      const orderData = await orderResponse.json().catch(() => ({}));

      if (!orderResponse.ok || !orderData.success) {
        throw new Error(
          orderData.message ||
            "Unable to prepare your payment. Please review your booking and try again."
        );
      }

      const order = orderData.order || orderData;
      const orderId = order.id || order.orderId;
      const paymentRecordId =
        orderData.paymentRecordId ||
        orderData.payment?.paymentRecordId ||
        orderData.payment?.id ||
        orderData.recordId ||
        "";

      const razorpayKey =
        orderData.keyId ||
        orderData.key ||
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      if (!orderId) {
        throw new Error(
          "The payment order was created, but its order ID was missing. Please contact support before retrying."
        );
      }

      if (!razorpayKey) {
        throw new Error(
          "The Razorpay public key is missing. Configure NEXT_PUBLIC_RAZORPAY_KEY_ID or return keyId from the create-order API."
        );
      }

      await loadRazorpayScript();

      setPaymentMessage("Opening secure payment...");

      return await new Promise((resolve) => {
        let verificationStarted = false;
        let resolved = false;

        const finish = (result) => {
          if (resolved) return;
          resolved = true;
          resolve(result);
        };

        const razorpay = new window.Razorpay({
          key: razorpayKey,
          order_id: orderId,
          amount: order.amount,
          currency: order.currency || "INR",
          name: "SU VILLA",
          description: "SU VILLA booking",
          prefill: {
            name: customerDetails.name || "",
            email: customerDetails.email || "",
            contact: customerDetails.phone || "",
          },
          notes: {
            TempID,
            checkIn,
            checkOut,
          },
          theme: {
            color: "#052a50",
          },

          handler: async (response) => {
            if (verificationStarted) return;
            verificationStarted = true;

            setPaymentMessage(
              "Payment received by the gateway. Verifying your booking..."
            );

            try {
              const verifyResponse = await fetch(
                "/api/payments/verify",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature,
                    paymentRecordId,
                  }),
                }
              );

              const verifyData = await verifyResponse
                .json()
                .catch(() => ({}));

              if (verifyResponse.ok && verifyData.success) {
                const verifiedBooking =
                  verifyData.booking || verifyData.data || verifyData;

                setConfirmedBooking({
                  ...verifiedBooking,
                  checkIn,
                  checkOut,
                  paymentId: response.razorpay_payment_id,
                  totalAmount:
                    verifiedBooking.totalAmount ??
                    verifiedBooking.amount ??
                    Number(order.amount) / 100,
                });

                setPaymentMessage(
                  "Your payment has been verified and your booking is confirmed."
                );
                setStep("confirmation");

                finish({
                  success: true,
                  message: "Booking confirmed.",
                  booking: verifiedBooking,
                });

                return;
              }

              // Do not label a paid transaction as rejected merely
              // because verification is temporarily unavailable.
              if (
                verifyData.pending ||
                verifyResponse.status >= 500 ||
                verifyResponse.status === 429
              ) {
                setPaymentMessage(
                  verifyData.message ||
                    "Your payment may have succeeded, but booking verification is still pending. Please do not pay again. Contact SU VILLA if this message remains."
                );
                setStep("pending");

                finish({
                  success: false,
                  pending: true,
                  message:
                    verifyData.message ||
                    "Payment verification is pending. Please do not pay again.",
                });

                return;
              }

              if (verifyData.rejected === true) {
                setPaymentMessage(
                  verifyData.message ||
                    "The payment could not be verified. Please contact support if money was deducted."
                );
                setStep("rejected");

                finish({
                  success: false,
                  rejected: true,
                  message: verifyData.message || "Payment was rejected.",
                });

                return;
              }

              setPaymentMessage(
                verifyData.message ||
                  "We could not confirm the booking yet. Please do not pay again until your payment status is checked."
              );
              setStep("pending");

              finish({
                success: false,
                pending: true,
                message:
                  verifyData.message ||
                  "Booking verification is pending.",
              });
            } catch (error) {
              console.error("Payment verification error:", error);

              setPaymentMessage(
                "We could not confirm your booking status because the verification service could not be reached. Please do not pay again. Contact SU VILLA with your Razorpay payment ID."
              );
              setStep("pending");

              finish({
                success: false,
                pending: true,
                message: "Payment verification is pending.",
              });
            }
          },

          modal: {
            ondismiss: () => {
              if (verificationStarted) return;

              setPaymentMessage(
                "The payment window was closed. If you completed a payment, please wait while its status is checked before trying again."
              );

              finish({
                success: false,
                message: "Payment window closed.",
              });
            },
          },
        });

        razorpay.on("payment.failed", (response) => {
          const failureMessage =
            response?.error?.description ||
            "The payment attempt failed. You can try again.";

          setPaymentMessage(failureMessage);
          setStep("rejected");

          finish({
            success: false,
            rejected: true,
            message: failureMessage,
          });
        });

        try {
          razorpay.open();
        } catch (error) {
          console.error("Unable to open Razorpay:", error);

          setPaymentMessage(
            "Unable to open the payment window. Please try again."
          );

          finish({
            success: false,
            message: "Unable to open the payment window.",
          });
        }
      });
    } catch (error) {
      console.error("Unable to start payment:", error);

      const message =
        error?.message ||
        "Payment could not be started. Please try again.";

      setPaymentMessage(message);

      return {
        success: false,
        message,
      };
    } finally {
      setIsPaymentStarting(false);
    }
  }

  const modalTitle =
    step === "cart"
      ? "Your Cart"
      : step === "addons"
        ? "Add-ons"
        : step === "details"
          ? "Your Details"
          : step === "confirmation"
            ? "Booking Confirmed"
            : step === "pending"
              ? "Payment Verification"
              : step === "rejected"
                ? "Payment Unsuccessful"
                : "Checkout";

  return (
    <>
      {/* Fixed floating cart button */}
      <button
        type="button"
        onClick={() => {
          if (isPaymentStarting) return;

          if (
            step !== "confirmation" &&
            step !== "pending" &&
            step !== "rejected"
          ) {
            setStep("cart");
          }

          setIsOpen(true);
        }}
        aria-label={`Open cart, ${itemCount} selected ${
          itemCount === 1 ? "item" : "items"
        }`}
        className="fixed bottom-5 right-5 z-[90] flex h-16 w-16 items-center justify-center rounded-full bg-[#052a50] text-white shadow-xl transition hover:scale-105 hover:bg-[#e4b441] hover:text-[#052a50] focus:outline-none focus:ring-4 focus:ring-[#e4b441]/50 sm:bottom-7 sm:right-7"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7"
          aria-hidden="true"
        >
          <path d="M3 3h2l2.4 11.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 1.9-1.4L21 8H6" />
          <circle cx="10" cy="20" r="1" />
          <circle cx="18" cy="20" r="1" />
        </svg>

        {itemCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-[#F7FAEE] bg-[#e4b441] px-1 text-xs font-bold text-[#052a50]">
            {itemCount}
          </span>
        )}
      </button>

      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={modalTitle}
      >
        {/* CART */}
        {step === "cart" && (
          <>
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="text-sm text-[#052a50]/65">
                {itemCount} {itemCount === 1 ? "item" : "items"} selected
              </p>

              <button
                type="button"
                onClick={handleClear}
                disabled={itemCount === 0 || isPaymentStarting}
                className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear
              </button>
            </div>

            {itemCount === 0 ? (
              <div className="rounded-2xl border border-[#052a50]/10 bg-white px-5 py-10 text-center">
                <h3 className="text-lg font-semibold text-[#052a50]">
                  Your cart is empty
                </h3>

                <p className="mt-2 text-sm text-[#052a50]/60">
                  Select a room or a stay package to see it here.
                </p>

                <button
                  type="button"
                  onClick={handleClose}
                  className="mt-5 rounded-xl bg-[#052a50] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#e4b441] hover:text-[#052a50]"
                >
                  Continue Browsing
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedRooms.map((room) => {
                  const basePrice = Number(
                    room.basePrice ??
                      room.price ??
                      PRICING.accommodation.weekday
                  );

                  const extraAdults = Number(room.extraAdults) || 0;
                  const extraChildren = Number(room.extraChildren) || 0;

                  const roomNights = Math.max(
                    1,
                    Number(room.nights ?? stayNights) || 1
                  );

                  const roomTotal =
                    room.totalPrice !== undefined &&
                    room.totalPrice !== null &&
                    Number.isFinite(Number(room.totalPrice))
                      ? Number(room.totalPrice)
                      : calculateRoomPrice({
                          basePrice,
                          extraAdults,
                          chargeableChildren: extraChildren,
                          nights: roomNights,
                        });

                  return (
                    <article
                      key={room.id}
                      className="rounded-2xl border border-[#052a50]/10 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#b08a28]">
                            Room
                          </p>

                          <h3 className="mt-1 font-semibold text-[#052a50]">
                            {room.name}
                          </h3>

                          <p className="mt-1 text-sm text-[#052a50]/60">
                            {roomNights}{" "}
                            {roomNights === 1 ? "night" : "nights"}
                          </p>

                          <p className="mt-2 text-xs leading-5 text-[#052a50]/65">
                            Base rate: {formatPrice(basePrice)} / night
                          </p>

                          {extraAdults > 0 && (
                            <p className="text-xs leading-5 text-[#052a50]/65">
                              {extraAdults} extra{" "}
                              {extraAdults === 1 ? "adult" : "adults"} ×{" "}
                              {formatPrice(PRICING.extraGuests.adult)} / night
                            </p>
                          )}

                          {extraChildren > 0 && (
                            <p className="text-xs leading-5 text-[#052a50]/65">
                              {extraChildren}{" "}
                              {extraChildren === 1 ? "child" : "children"} ×{" "}
                              {formatPrice(PRICING.extraGuests.child)} / night
                            </p>
                          )}

                          <p className="mt-1 text-xs text-[#052a50]/55">
                            Breakfast included
                          </p>
                        </div>

                        <p className="shrink-0 text-right text-sm font-semibold text-[#052a50]">
                          {formatPrice(roomTotal)}
                        </p>
                      </div>
                    </article>
                  );
                })}

                {selectedPackages.map((pkg) => {
                  const basePrice = Number(
                    pkg.price ?? pkg.basePrice ?? 0
                  );

                  return (
                    <article
                      key={pkg.id}
                      className="rounded-2xl border border-[#052a50]/10 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#b08a28]">
                            Package
                          </p>

                          <h3 className="mt-1 font-semibold text-[#052a50]">
                            {pkg.name || pkg.shortName}
                          </h3>

                          <p className="mt-1 text-sm text-[#052a50]/60">
                            {stayNights}{" "}
                            {stayNights === 1 ? "night" : "nights"}
                          </p>
                        </div>

                        <p className="shrink-0 text-right text-sm font-semibold text-[#052a50]">
                          {basePrice > 0
                            ? formatPrice(basePrice * stayNights)
                            : "Price to be confirmed"}
                        </p>
                      </div>
                    </article>
                  );
                })}

                <p className="text-xs leading-5 text-[#052a50]/55">
                  Prices are shown before tax. Complimentary breakfast
                  is included in the room rate.
                </p>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 rounded-xl border border-[#052a50]/20 bg-white px-4 py-3.5 text-sm font-semibold text-[#052a50] transition hover:bg-[#052a50]/5"
                  >
                    Continue Browsing
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep("addons")}
                    className="flex-1 rounded-xl bg-[#052a50] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#e4b441] hover:text-[#052a50]"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ADD-ONS AND CUSTOMER DETAILS */}
        {step === "addons" && (
          <Addons
            nights={stayNights}
            value={addons}
            onChange={setAddons}
            onBack={() => setStep("cart")}
            onNext={handleAddonsNext}
            initialDetails={customerDetails}
          />
        )}

        {/* CHECKOUT */}
        {step === "checkout" && (
          <Checkout
            rooms={selectedRooms}
            packages={selectedPackages}
            addons={addons}
            details={customerDetails}
            nights={stayNights}
            onBack={() => setStep("addons")}
            onPay={handlePay}
            paymentMessage={paymentMessage}
          />
        )}

        {/* CONFIRMATION */}
        {step === "confirmation" && (
          <Confirmation
            booking={confirmedBooking}
            customer={customerDetails}
            checkIn={confirmedBooking?.checkIn}
            checkOut={confirmedBooking?.checkOut}
            nights={stayNights}
            amount={confirmedBooking?.totalAmount}
            onDone={() => {
              setIsOpen(false);
              setStep("cart");
              setConfirmedBooking(null);
              setPaymentMessage("");
              resetAddons();
              setCustomerDetails({});
              onClear?.();
            }}
          />
        )}

        {/* PENDING VERIFICATION */}
        {step === "pending" && (
          <section className="rounded-2xl border border-[#e4b441]/60 bg-white p-6 text-center">
            <h3 className="text-xl font-semibold text-[#052a50]">
              Payment verification pending
            </h3>

            <p className="mt-3 text-sm leading-6 text-[#052a50]/70">
              {paymentMessage ||
                "Your payment status is being checked."}
            </p>

            <p className="mt-3 text-sm font-semibold text-[#052a50]">
              Please do not make another payment until your payment
              status has been confirmed.
            </p>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="mt-6 w-full rounded-xl border border-[#052a50]/20 bg-white px-5 py-3 text-sm font-semibold text-[#052a50] transition hover:bg-[#052a50]/5"
            >
              Close
            </button>
          </section>
        )}

        {/* DEFINITIVE PAYMENT FAILURE */}
        {step === "rejected" && (
          <Rejected
            title="Payment unsuccessful"
            message={
              paymentMessage ||
              "The payment attempt was unsuccessful. Please check your payment status."
            }
            onRetry={() => {
              setPaymentMessage("");
              setStep("checkout");
            }}
            onClose={() => setIsOpen(false)}
            retryLabel="Return to checkout"
          />
        )}
      </Modal>
    </>
  );
}
