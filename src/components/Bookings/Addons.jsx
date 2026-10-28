
"use client";

import { useState } from "react";
import Details from "./Details";

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

function formatPrice(price) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

function Counter({ value, onChange, label }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        aria-label={`Remove ${label}`}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#052a50]/20 bg-white text-lg text-[#052a50] hover:bg-[#e4b441] disabled:cursor-not-allowed disabled:opacity-35"
      >
        −
      </button>

      <span className="w-5 text-center text-sm font-semibold tabular-nums text-[#052a50]">
        {value}
      </span>

      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label={`Add ${label}`}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#052a50]/20 bg-white text-lg text-[#052a50] hover:bg-[#e4b441]"
      >
        +
      </button>
    </div>
  );
}

export default function Addons({
  nights = 1,
  value,
  onChange,
  onBack,
  onNext,
  initialDetails = {},
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState(null);

  const stayNights = Math.max(1, Number(nights) || 1);

  const addons = value || {
    mealPlan: "",
    mealGuests: 2,
    drivers: 0,
    driverMealPlan: "",
  };

  function update(patch) {
    onChange?.({ ...addons, ...patch });
  }

  const guestCount = Math.max(1, Number(addons.mealGuests) || 1);
  const driverCount = Math.max(0, Number(addons.drivers) || 0);

  const selectedMeal = MEAL_OPTIONS.find(
    (option) => option.id === addons.mealPlan
  );

  const selectedDriverMeal = MEAL_OPTIONS.find(
    (option) => option.id === addons.driverMealPlan
  );

  const mealTotal = selectedMeal
    ? selectedMeal.price * guestCount * stayNights
    : 0;

  const driverAccommodationTotal =
    driverCount * ADDON_PRICES.driverAccommodation * stayNights;

  const driverMealTotal = selectedDriverMeal
    ? selectedDriverMeal.price * driverCount * stayNights
    : 0;

  const totalAddons =
    mealTotal + driverAccommodationTotal + driverMealTotal;

  function handleAddonsNext() {
    const addonsData = {
      ...addons,
      totalAddons,
      nights: stayNights,
    };

    setSelectedAddons(addonsData);
    setShowDetails(true);

    // Preserve the add-ons in the parent booking state.
    onChange?.(addonsData);
  }

  function handleDetailsBack() {
    setShowDetails(false);
  }

  function handleDetailsNext(details) {
    onNext?.({
      addons: selectedAddons || {
        ...addons,
        totalAddons,
        nights: stayNights,
      },
      details,
    });
  }

  // Show Details.jsx after the user clicks Next in the add-ons step.
  if (showDetails) {
    return (
      <Details
        initialDetails={initialDetails}
        onBack={handleDetailsBack}
        onNext={handleDetailsNext}
      />
    );
  }

  return (
    <div className="space-y-7">
      {/* Meals section */}
      <section>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-[#052a50]">
            Meals
          </h3>
          <p className="mt-1 text-sm text-[#052a50]/60">
            Choose one meal plan for your guests.
          </p>
        </div>

        <div className="space-y-3">
          {MEAL_OPTIONS.map((meal) => {
            const selected = addons.mealPlan === meal.id;

            return (
              <label
                key={meal.id}
                className={`block cursor-pointer rounded-2xl border p-4 transition ${
                  selected
                    ? "border-[#e4b441] bg-[#e4b441]/10 ring-1 ring-[#e4b441]"
                    : "border-[#052a50]/10 bg-white hover:border-[#e4b441]/70"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="guest-meal-plan"
                    value={meal.id}
                    checked={selected}
                    onChange={() => update({ mealPlan: meal.id })}
                    className="h-4 w-4 accent-[#052a50]"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#052a50]">
                      {meal.label}
                    </p>
                    <p className="mt-1 text-xs text-[#052a50]/60">
                      {formatPrice(meal.price)} per person per night
                    </p>
                  </div>

                  {selected && (
                    <span className="text-xs font-semibold text-[#b08a28]">
                      Selected
                    </span>
                  )}
                </div>

                {selected && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#052a50]/10 pt-4">
                    <div>
                      <p className="text-sm font-medium text-[#052a50]">
                        Number of guests
                      </p>
                      <p className="mt-1 text-xs text-[#052a50]/60">
                        {formatPrice(meal.price)} × {guestCount} guests ×{" "}
                        {stayNights} {stayNights === 1 ? "night" : "nights"}
                      </p>
                    </div>

                    <Counter
                      value={guestCount}
                      onChange={(count) =>
                        update({ mealGuests: Math.max(1, count) })
                      }
                      label="meal guest"
                    />
                  </div>
                )}
              </label>
            );
          })}
        </div>
      </section>

      {/* Driver accommodation section */}
      <section>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-[#052a50]">
            Driver Accommodation
          </h3>
          <p className="mt-1 text-sm text-[#052a50]/60">
            Add accommodation and meals for your drivers if required.
          </p>
        </div>

        <div className="rounded-2xl border border-[#052a50]/10 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-[#052a50]">
                Number of drivers
              </p>
              <p className="mt-1 text-xs text-[#052a50]/60">
                {formatPrice(ADDON_PRICES.driverAccommodation)} per driver per
                night
              </p>
            </div>

            <Counter
              value={driverCount}
              onChange={(count) =>
                update({
                  drivers: count,
                  driverMealPlan:
                    count === 0 ? "" : addons.driverMealPlan,
                })
              }
              label="driver"
            />
          </div>

          {driverCount > 0 && (
            <div className="mt-5 border-t border-[#052a50]/10 pt-5">
              <h4 className="font-semibold text-[#052a50]">
                Driver Meal Plan
              </h4>

              <p className="mt-1 text-xs text-[#052a50]/60">
                Choose one meal plan for your drivers.
              </p>

              <div className="mt-3 space-y-2">
                {MEAL_OPTIONS.map((meal) => {
                  const selected = addons.driverMealPlan === meal.id;

                  return (
                    <label
                      key={meal.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                        selected
                          ? "border-[#e4b441] bg-[#e4b441]/10"
                          : "border-[#052a50]/10 hover:border-[#e4b441]/70"
                      }`}
                    >
                      <input
                        type="radio"
                        name="driver-meal-plan"
                        value={meal.id}
                        checked={selected}
                        onChange={() =>
                          update({ driverMealPlan: meal.id })
                        }
                        className="h-4 w-4 accent-[#052a50]"
                      />

                      <span className="flex-1 text-sm font-medium text-[#052a50]">
                        {meal.label}
                      </span>

                      <span className="text-xs text-[#052a50]/65">
                        {formatPrice(meal.price)} / driver / night
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Total add-ons price */}
      <section className="rounded-2xl border border-[#e4b441]/60 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#052a50]/60">
          Total Add-ons Price
        </p>

        <p className="mt-2 text-3xl font-semibold tracking-tight text-[#052a50]">
          {formatPrice(totalAddons)}
        </p>

        <p className="mt-2 text-xs text-[#052a50]/55">
          Includes selected meals and driver accommodation for {stayNights}{" "}
          {stayNights === 1 ? "night" : "nights"}.
        </p>
      </section>

      {/* Navigation */}
      <div className="flex gap-3 border-t border-[#052a50]/10 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-xl border border-[#052a50]/20 bg-white px-4 py-3.5 text-sm font-semibold text-[#052a50] transition hover:bg-[#052a50]/5"
        >
          Back
        </button>

        <button
          type="button"
          onClick={handleAddonsNext}
          className="flex-1 rounded-xl bg-[#052a50] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#e4b441] hover:text-[#052a50]"
        >
          Next
        </button>
      </div>
    </div>
  );
}
