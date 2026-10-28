
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

export default function Cart({
  selectedRoomIds = [],
  selectedRoomData = [],
  selectedPackageIds = [],
  availableRoomIds = null,
  nights = 1,
  onClear,
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

  // Prefer the latest selected room objects from RoomsCard.
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
    onClear?.();
    resetAddons();
    setCustomerDetails({});
    setPaymentMessage("");
    setStep("cart");
  }

  function handleClose() {
    setIsOpen(false);
    setStep("cart");
  }

  function handleAddonsNext(result) {
    // Addons passes { addons, details } after Details.jsx is completed.
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

  function handlePay(paymentData) {
    // This prepares the checkout data only.
    // Connect Razorpay before processing a real payment.
    setPaymentMessage(
      "Your booking total is ready. Payment processing will be available once the payment gateway is connected."
    );

    console.log("Checkout summary:", paymentData);
  }

  const modalTitle =
    step === "cart"
      ? "Your Cart"
      : step === "addons"
        ? "Add-ons"
        : step === "details"
          ? "Your Details"
          : "Checkout";

  return (
    <>
      {/* Fixed floating cart button */}
      <button
        type="button"
        onClick={() => {
          setStep("cart");
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
                disabled={itemCount === 0}
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
                {/* Selected rooms */}
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

                {/* Selected packages */}
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

        {/* ADD-ONS AND DETAILS */}
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
      </Modal>
    </>
  );
}
