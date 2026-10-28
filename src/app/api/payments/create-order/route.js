import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getDb } from "@/lib/mongodb";
import rooms from "@/data/rooms.json";

export const runtime = "nodejs";

// Server-authoritative rates (INR/night); keep synchronized with the approved price list.
const ROOM_RATES = { Room1: 6500, Room2: 7000, Room3: 5500, Room4: 6000 };
const ADDON_RATES = { lunch: 550, dinner: 650, lunchDinner: 1100, driverAccommodation: 1500 };
const PROMOS = { SUVILLA10: 10, WELCOME5: 5, STAY15: 15 };
const TAX_RATE = 0.18;
const PLATFORM_FEE_RATE = 0.02;

const fail = (message, status = 400) => NextResponse.json({ success: false, message }, { status });
const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(new Date(`${v}T00:00:00.000Z`).getTime()) &&
  new Date(`${v}T00:00:00.000Z`).toISOString().slice(0, 10) === v;
const datesBetween = (a, b) => {
  const dates = [], d = new Date(`${a}T00:00:00.000Z`), end = new Date(`${b}T00:00:00.000Z`);
  while (d < end) { dates.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return dates;
};
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function quoteBooking({ holds, roomSelections, checkIn, checkOut, addons, promoCode }) {
  const nights = datesBetween(checkIn, checkOut).length;
  let roomSubtotal = 0;
  const pricedRooms = holds.map((hold) => {
    const selection = roomSelections.find((r) => r.roomId === hold.roomId);
    const base = ROOM_RATES[hold.roomId];
    if (!selection || !base) throw new Error("Missing room price or occupancy details.");
    const extraAdults = Math.max(0, Math.min(10, Math.floor(Number(selection.extraAdults) || 0)));
    const extraChildren = Math.max(0, Math.min(10, Math.floor(Number(selection.extraChildren) || 0)));
    const amount = round((base + extraAdults * 4000 + extraChildren * 2000) * nights);
    roomSubtotal += amount;
    return { roomId: hold.roomId, roomName: rooms.find(r => r.id === hold.roomId)?.name || hold.roomId,
      check_in: checkIn, check_out: checkOut, nights, extra_adults: extraAdults, chargeable_children: extraChildren, amount };
  });
  const validPlans = ["", "lunch", "dinner", "lunchDinner"];
  if (!validPlans.includes(addons?.mealPlan || "") || !validPlans.includes(addons?.driverMealPlan || "")) {
    throw new Error("Invalid add-on selection.");
  }
  const guests = Math.max(0, Math.min(100, Math.floor(Number(addons?.mealGuests) || 0)));
  const drivers = Math.max(0, Math.min(4, Math.floor(Number(addons?.drivers) || 0)));
  const meal = addons.mealPlan ? ADDON_RATES[addons.mealPlan] * guests * nights : 0;
  const driverStay = drivers * ADDON_RATES.driverAccommodation * nights;
  const driverMeals = addons.driverMealPlan ? ADDON_RATES[addons.driverMealPlan] * drivers * nights : 0;
  const subtotal = round(roomSubtotal + meal + driverStay + driverMeals);
  const code = typeof promoCode === "string" ? promoCode.trim().toUpperCase() : "";
  if (code && !PROMOS[code]) throw new Error("Invalid promo code.");
  const discountPercent = code ? PROMOS[code] : 0;
  const discount = round(subtotal * discountPercent / 100);
  const taxable = round(subtotal - discount);
  const tax = round(taxable * TAX_RATE);
  const platformFee = round(taxable * PLATFORM_FEE_RATE);
  return {
    nights, rooms: pricedRooms, roomSubtotal: round(roomSubtotal),
    addons: { mealPlan: addons.mealPlan || "", mealGuests: guests, drivers,
      driverMealPlan: addons.driverMealPlan || "", mealSubtotal: round(meal),
      driverAccommodation: round(driverStay), driverMeals: round(driverMeals),
      total: round(meal + driverStay + driverMeals) },
    subtotal, promoCode: code || null, discountPercent, discount, tax, platformFee,
    total: round(taxable + tax + platformFee),
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { TempID, checkIn, checkOut, roomSelections, addons = {}, details, promoCode } = body || {};
    if (typeof TempID !== "string" || !TempID.trim() || TempID.length > 150) return fail("Valid TempID required.");
    if (!isDate(checkIn) || !isDate(checkOut) || checkOut <= checkIn) return fail("Valid check-in and check-out dates required.");
    const stayDates = datesBetween(checkIn, checkOut);
    if (stayDates.length < 1 || stayDates.length > 10) return fail("Stay must be between 1 and 10 nights.");
    if (!Array.isArray(roomSelections) || !roomSelections.length || roomSelections.length > 4) return fail("Select one to four rooms.");
    if (!details || !["name", "email", "phone", "address", "city", "pincode"].every(k => typeof details[k] === "string" && details[k].trim())) {
      return fail("Complete all required customer details.");
    }
    const roomIds = roomSelections.map(r => r?.roomId);
    if (new Set(roomIds).size !== roomIds.length || roomIds.some(id => !rooms.some(r => r.id === id))) return fail("Invalid or duplicate room selection.");

    const keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return fail("Payment service is not configured.", 503);
    const db = await getDb();
    const now = new Date();
    const holds = await db.collection("temp_books").find({
      TempID, roomId: { $in: roomIds }, checkIn, checkOut, expiresAt: { $gt: now }, status: "active"
    }).toArray();
    if (holds.length !== roomIds.length || new Set(holds.map(h => h.roomId)).size !== roomIds.length) {
      return fail("A room hold has expired. Please select your rooms again.", 409);
    }
    for (const date of stayDates) {
      const record = await db.collection("room_availabilty").findOne({ date });
      if (roomIds.some(id => (record?.booked_rooms || []).includes(id) || (record?.blocked_rooms || []).includes(id))) {
        return fail("A selected room is no longer available.", 409);
      }
    }

    const quote = quoteBooking({ holds, roomSelections, checkIn, checkOut, addons, promoCode });
    const amountPaise = Math.round(quote.total * 100);
    if (!Number.isSafeInteger(amountPaise) || amountPaise < 100) return fail("Invalid payment amount.");
    const bookingId = `SUV-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt: bookingId.slice(0, 40), notes: { booking_id: bookingId, TempID } }),
      cache: "no-store",
    });
    const order = await response.json();
    if (!response.ok || !order.id || order.amount !== amountPaise) {
      console.error("Razorpay order creation failed:", order?.error?.description || response.status);
      return fail("Unable to start payment. Please try again.", 502);
    }
    const paymentRecord = {
      booking_id: bookingId, TempID, razorpay_order_id: order.id, amount_paise: amountPaise,
      currency: "INR", quote,
      customer: { name: details.name.trim(), email: details.email.trim(), phone: details.phone.trim(),
        address: details.address.trim(), city: details.city.trim(), pin_code: details.pincode.trim(),
        aadhar_number: String(details.aadharNumber || "").trim(),
        special_request: String(details.specialRequests || "").trim() },
      holds: holds.map(h => ({ roomId: h.roomId, roomName: h.roomName || h.roomId,
        checkIn: h.checkIn, checkOut: h.checkOut, stayDates: h.stayDates, expiresAt: h.expiresAt })),
      addons: quote.addons, status: "created", createdAt: now,
    };
    const inserted = await db.collection("payment_orders").insertOne(paymentRecord);
    return NextResponse.json({ success: true, orderId: order.id, keyId, amount: amountPaise,
      currency: "INR", quote, paymentRecordId: String(inserted.insertedId), bookingId });
  } catch (error) {
    console.error("Create Razorpay order failed:", error);
    return fail(error.message || "Unable to create payment order.", error.message === "Invalid promo code." ? 400 : 500);
  }
}
