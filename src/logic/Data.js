
"use client";

import { useEffect, useSyncExternalStore } from "react";

const TEMP_ID_KEY = "suvilla_temp_booking_id";
const HOLD_EXPIRY_KEY = "suvilla_temp_booking_expiry";
export const TEMP_HOLD_DURATION_MS = 10 * 60 * 1000;

function generateId(prefix) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `${prefix}-${timestamp}-${random}`;
}

function createInitialData() {
  return {
    TempID: null,
    BookingID: null,
    BookingStatus: "in_progress",

    CheckIN: "",
    CheckOUT: "",
    Nights: 0,

    // Temporary room-hold information
    HoldExpiresAt: null,

    Guests: {
      TotalAdults: 0,
      TotalChild: 0,
    },

    Rooms: {
      TotalRooms: 0,
      SelectedRooms: [],
    },

    Meals: {
      Lunch: 0,
      Dinner: 0,
      LunchDinner: 0,
    },

    Driver: {
      TotalDrivers: 0,
      Lunch: 0,
      Dinner: 0,
      LunchDinner: 0,
    },

    Information: {
      Name: "",
      Email: "",
      PhoneNumber: "",
      Address: "",
      City: "",
      PinCode: "",
      AadharNumber: "",
      SpecialRequests: "",
    },
  };
}

let bookingData = createInitialData();
const listeners = new Set();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return bookingData;
}

function getServerSnapshot() {
  return bookingData;
}

function updateBookingData(patch) {
  bookingData = {
    ...bookingData,
    ...patch,
  };

  notifyListeners();

  return bookingData;
}

function getStoredValue(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStoredValue(key, value) {
  try {
    if (value == null) {
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, String(value));
    }
  } catch {
    // Session storage may be unavailable.
  }
}

/**
 * Creates or retrieves the temporary booking ID.
 * Call when the booking experience first loads.
 */
export function initializeTempID() {
  if (bookingData.TempID) {
    return bookingData.TempID;
  }

  let tempID = getStoredValue(TEMP_ID_KEY);

  if (!tempID) {
    tempID = generateId("TMP");
    setStoredValue(TEMP_ID_KEY, tempID);
  }

  updateBookingData({
    TempID: tempID,
  });

  // Restore the expiry timestamp after a page refresh.
  const storedExpiry = getStoredValue(HOLD_EXPIRY_KEY);
  const expiry = storedExpiry ? Number(storedExpiry) : null;

  if (expiry && Number.isFinite(expiry) && expiry > Date.now()) {
    updateBookingData({
      HoldExpiresAt: expiry,
    });
  } else if (expiry) {
    clearHoldExpiry();
  }

  return tempID;
}

/**
 * Start or update the local countdown expiry.
 * Call after the backend successfully creates a temporary hold.
 *
 * Pass the expiresAt value returned by the backend when possible.
 */
export function startTemporaryHold(expiresAt = null) {
  const expiry =
    expiresAt != null
      ? new Date(expiresAt).getTime()
      : Date.now() + TEMP_HOLD_DURATION_MS;

  if (!Number.isFinite(expiry) || expiry <= Date.now()) {
    clearHoldExpiry();
    return null;
  }

  setStoredValue(HOLD_EXPIRY_KEY, expiry);

  updateBookingData({
    HoldExpiresAt: expiry,
  });

  return expiry;
}

/**
 * Clear the local hold countdown.
 * This does not release holds in MongoDB.
 * Use the temporary-hold API for server-side release.
 */
export function clearHoldExpiry() {
  setStoredValue(HOLD_EXPIRY_KEY, null);

  updateBookingData({
    HoldExpiresAt: null,
  });
}

/**
 * Returns remaining hold time in milliseconds.
 */
export function getHoldTimeRemaining() {
  if (!bookingData.HoldExpiresAt) {
    return 0;
  }

  return Math.max(0, bookingData.HoldExpiresAt - Date.now());
}

/**
 * Update check-in/check-out dates and calculate nights.
 */
export function updateBookingDates(checkIn, checkOut) {
  let nights = 0;

  if (checkIn && checkOut) {
    const start = new Date(`${checkIn}T00:00:00`);
    const end = new Date(`${checkOut}T00:00:00`);

    if (
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime()) &&
      end > start
    ) {
      nights = Math.round(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );
    }
  }

  return updateBookingData({
    CheckIN: checkIn || "",
    CheckOUT: checkOut || "",
    Nights: nights,
  });
}

/**
 * Store selected rooms and calculate total adults and children.
 * Each selected room includes 2 base adults.
 * extraAdults and extraChildren are additional occupants for that room.
 */
export function updateBookingRooms(selectedRooms = []) {
  const rooms = selectedRooms.map((room) => ({
    id: room.id,
    name: room.name || room.shortName || room.id,
    extraAdults: Math.max(0, Number(room.extraAdults) || 0),
    extraChildren: Math.max(0, Number(room.extraChildren) || 0),
  }));

  const totalAdults = rooms.reduce(
    (total, room) => total + 2 + room.extraAdults,
    0
  );

  const totalChildren = rooms.reduce(
    (total, room) => total + room.extraChildren,
    0
  );

  return updateBookingData({
    Rooms: {
      TotalRooms: rooms.length,
      SelectedRooms: rooms.map((room) => room.name),
    },
    Guests: {
      TotalAdults: totalAdults,
      TotalChild: totalChildren,
    },
  });
}

/**
 * Store meal quantities for guests.
 * The current Addons UI allows one guest meal plan at a time.
 */
export function updateBookingMeals({
  mealPlan = "",
  mealGuests = 0,
} = {}) {
  const count = Math.max(0, Number(mealGuests) || 0);

  return updateBookingData({
    Meals: {
      Lunch: mealPlan === "lunch" ? count : 0,
      Dinner: mealPlan === "dinner" ? count : 0,
      LunchDinner: mealPlan === "lunchDinner" ? count : 0,
    },
  });
}

/**
 * Store driver accommodation and driver meal quantities.
 * A maximum of 4 drivers is allowed.
 */
export function updateBookingDrivers({
  drivers = 0,
  driverMealPlan = "",
} = {}) {
  const totalDrivers = Math.min(
    4,
    Math.max(0, Math.floor(Number(drivers) || 0))
  );

  return updateBookingData({
    Driver: {
      TotalDrivers: totalDrivers,
      Lunch:
        totalDrivers > 0 && driverMealPlan === "lunch"
          ? totalDrivers
          : 0,
      Dinner:
        totalDrivers > 0 && driverMealPlan === "dinner"
          ? totalDrivers
          : 0,
      LunchDinner:
        totalDrivers > 0 && driverMealPlan === "lunchDinner"
          ? totalDrivers
          : 0,
    },
  });
}

/**
 * Store personal and billing details.
 */
export function updateBookingInformation(details = {}) {
  return updateBookingData({
    Information: {
      Name: details.name ?? bookingData.Information.Name,
      Email: details.email ?? bookingData.Information.Email,
      PhoneNumber: details.phone ?? bookingData.Information.PhoneNumber,
      Address: details.address ?? bookingData.Information.Address,
      City: details.city ?? bookingData.Information.City,
      PinCode: details.pincode ?? bookingData.Information.PinCode,
      AadharNumber:
        details.aadharNumber ?? bookingData.Information.AadharNumber,
      SpecialRequests:
        details.specialRequests ??
        bookingData.Information.SpecialRequests,
    },
  });
}

/**
 * Get the current complete booking record.
 */
export function getBookingData() {
  return bookingData;
}

/**
 * Update any supported top-level booking field.
 * Prefer the dedicated update functions above for structured fields.
 */
export function updateBookingRecord(patch) {
  return updateBookingData(patch);
}

/**
 * Call ONLY after the booking/payment has been confirmed successfully.
 */
export function finalizeBooking(confirmedBookingID = null) {
  if (bookingData.BookingStatus === "confirmed" && bookingData.BookingID) {
    return bookingData;
  }

  const bookingID = confirmedBookingID || generateId("SUV");

  return updateBookingData({
    BookingID: bookingID,
    BookingStatus: "confirmed",
    HoldExpiresAt: null,
  });
}

/**
 * React hook for components that need shared booking data.
 */
export function useBookingData() {
  const data = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    initializeTempID();
  }, []);

  return data;
}

/**
 * Clear the current booking and start a fresh temporary session.
 * This only resets local state; release server-side holds separately.
 */
export function resetBookingData() {
  bookingData = createInitialData();

  setStoredValue(TEMP_ID_KEY, null);
  setStoredValue(HOLD_EXPIRY_KEY, null);

  initializeTempID();
  notifyListeners();

  return bookingData;
}
