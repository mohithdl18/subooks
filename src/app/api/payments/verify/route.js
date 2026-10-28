import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { ObjectId } from "mongodb";
import { getDb, clientPromise } from "@/lib/mongodb";

// export const runtime = "nodejs";
const fail = (message, status = 400, extra = {}) => NextResponse.json({ success: false, message, ...extra }, { status });

function sameHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) return false;
  const x = Buffer.from(a, "hex"), y = Buffer.from(b, "hex");
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId,
      razorpay_signature: signature, paymentRecordId } = body || {};
    if (![orderId, paymentId, signature, paymentRecordId].every(v => typeof v === "string" && v) ||
        !ObjectId.isValid(paymentRecordId)) return fail("Invalid payment verification fields.");
    const keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return fail("Payment service is not configured.", 503);
    const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
    if (!sameHex(expected, signature)) return fail("Payment signature verification failed.");

    const db = await getDb(), client = await clientPromise;
    const paymentRecord = await db.collection("payment_orders").findOne({ _id: new ObjectId(paymentRecordId), razorpay_order_id: orderId });
    if (!paymentRecord) return fail("Payment order not found.", 404);

    // Confirm against Razorpay directly. Browser callback data alone is never sufficient.
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Basic ${auth}` }, cache: "no-store"
    });
    const payment = await response.json();
    if (!response.ok || payment.order_id !== orderId || payment.amount !== paymentRecord.amount_paise ||
        payment.currency !== "INR" || payment.status !== "captured" || payment.captured !== true) {
      const failed = payment?.status === "failed";
      await db.collection("payment_orders").updateOne(
        { _id: paymentRecord._id, status: { $ne: "confirmed" } },
        { $set: { status: failed ? "failed" : "verification_pending", lastVerificationAt: new Date() } }
      );
      return NextResponse.json({ success: false, rejected: failed, pending: !failed,
        message: failed ? "Payment was not completed." : "Payment is not confirmed yet. Check status before trying again." },
        { status: failed ? 402 : 202 });
    }

    const session = client.startSession();
    let alreadyConfirmed = false;
    try {
      await session.withTransaction(async () => {
        const current = await db.collection("payment_orders").findOne({ _id: paymentRecord._id }, { session });
        if (!current) throw new Error("PAYMENT_RECORD_NOT_FOUND");
        const bookings = db.collection("bookings_data");
        const existing = await bookings.findOne({ booking_id: current.booking_id }, { session });
        if (existing?.status === "confirmed" && existing?.payment?.payment_id === paymentId) {
          alreadyConfirmed = true; return;
        }
        const now = new Date();
        const holdIds = current.holds.map(h => h.roomId);
        const liveHolds = await db.collection("temp_books").find({
          TempID: current.TempID, roomId: { $in: holdIds },
          checkIn: current.holds[0]?.checkIn, checkOut: current.holds[0]?.checkOut,
          expiresAt: { $gt: now }, status: "active"
        }, { session }).toArray();
        if (liveHolds.length !== current.holds.length) throw new Error("HOLD_EXPIRED_AFTER_PAYMENT");

        for (const hold of current.holds) {
          for (const date of hold.stayDates || []) {
            const record = await db.collection("room_availabilty").findOne({ date }, { session });
            if ((record?.booked_rooms || []).includes(hold.roomId) || (record?.blocked_rooms || []).includes(hold.roomId)) {
              throw new Error("ROOM_NO_LONGER_AVAILABLE");
            }
          }
        }

        const c = current.customer, a = current.addons, q = current.quote;
        const booking = {
          booking_id: current.booking_id,
          personal_info: { name: c.name, email: c.email, phone_number: c.phone,
            aadhar_number: c.aadhar_number || "", address: c.address, pin_code: c.pin_code,
            city: c.city, special_request: c.special_request || "" },
          check_in: current.holds[0]?.checkIn || "", check_out: current.holds[0]?.checkOut || "",
          nights: q.nights, rooms: q.rooms,
          dinner: ["dinner", "lunchDinner"].includes(a.mealPlan) ? a.mealGuests : 0,
          lunch: ["lunch", "lunchDinner"].includes(a.mealPlan) ? a.mealGuests : 0,
          driver: { accommodation: a.drivers > 0 ? "yes" : "no",
            dinner: ["dinner", "lunchDinner"].includes(a.driverMealPlan) ? "yes" : "no" },
          terms_conditions: "yes", paid_amount: current.amount_paise / 100, pricing: q,
          payment: { provider: "razorpay", order_id: orderId, payment_id: paymentId,
            status: "captured", currency: "INR", captured_at: new Date() },
          status: "confirmed", created_at: new Date(),
        };
        await bookings.updateOne({ booking_id: current.booking_id }, { $setOnInsert: booking }, { upsert: true, session });

        for (const hold of current.holds) {
          for (const date of hold.stayDates || []) {
            await db.collection("room_availabilty").updateOne({ date },
              { $setOnInsert: { date, booked_rooms: [], blocked_rooms: [] },
                $addToSet: { booked_rooms: hold.roomId },
                $pull: { temporary_holds: { TempID: current.TempID, roomId: hold.roomId } } },
              { upsert: true, session });
          }
          await db.collection("temp_books").deleteOne({ TempID: current.TempID, roomId: hold.roomId,
            checkIn: hold.checkIn, checkOut: hold.checkOut }, { session });
        }
        await db.collection("payment_orders").updateOne({ _id: current._id },
          { $set: { status: "confirmed", razorpay_payment_id: paymentId, verifiedAt: new Date() } }, { session });
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" });
    } finally { await session.endSession(); }

    return NextResponse.json({ success: true, bookingId: paymentRecord.booking_id, alreadyConfirmed,
      message: "Payment verified and booking confirmed." });
  } catch (error) {
    console.error("Payment verification/finalization failed:", error);
    const conflict = ["HOLD_EXPIRED_AFTER_PAYMENT", "ROOM_NO_LONGER_AVAILABLE"].includes(error.message);
    return fail(conflict
      ? "Payment may have been received but the room could not be confirmed automatically. Contact support; do not pay again."
      : "We could not finish verifying this payment. Check payment status before trying again.", conflict ? 409 : 500, { pending: true });
  }
}
