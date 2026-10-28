
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { ObjectId } from "mongodb";
import { getDb, clientPromise } from "@/lib/mongodb";

export const runtime = "nodejs";

const fail = (message, status = 400, extra = {}) =>
  NextResponse.json(
    { success: false, message, ...extra },
    { status }
  );

function sameHex(a, b) {
  if (
    typeof a !== "string" ||
    typeof b !== "string" ||
    !/^[a-f0-9]+$/i.test(a) ||
    !/^[a-f0-9]+$/i.test(b)
  ) {
    return false;
  }

  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");

  return (
    x.length === y.length &&
    crypto.timingSafeEqual(x, y)
  );
}

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      paymentRecordId,
    } = body || {};

    if (
      ![orderId, paymentId, signature, paymentRecordId].every(
        (value) => typeof value === "string" && value
      ) ||
      !ObjectId.isValid(paymentRecordId)
    ) {
      return fail("Invalid payment verification fields.");
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return fail("Payment service is not configured.", 503);
    }

    // Verify the Razorpay signature.
    const expected = crypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (!sameHex(expected, signature)) {
      return fail("Payment signature verification failed.");
    }

    const db = await getDb();
    const client = await clientPromise;

    const paymentOrders = db.collection("payment_orders");
    const bookings = db.collection("bookings_data");
    const availability = db.collection("room_availabilty");
    const temporaryBooks = db.collection("temp_books");

    const paymentRecord = await paymentOrders.findOne({
      _id: new ObjectId(paymentRecordId),
      razorpay_order_id: orderId,
    });

    if (!paymentRecord) {
      return fail("Payment order not found.", 404);
    }

    // Check the payment directly with Razorpay.
    const auth = Buffer.from(
      `${keyId}:${keySecret}`
    ).toString("base64");

    const response = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(
        paymentId
      )}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
        cache: "no-store",
      }
    );

    const payment = await response.json();

    if (
      !response.ok ||
      payment.order_id !== orderId ||
      payment.amount !== paymentRecord.amount_paise ||
      payment.currency !== "INR" ||
      payment.status !== "captured" ||
      payment.captured !== true
    ) {
      const failed = payment?.status === "failed";

      await paymentOrders.updateOne(
        {
          _id: paymentRecord._id,
          status: { $ne: "confirmed" },
        },
        {
          $set: {
            status: failed ? "failed" : "verification_pending",
            lastVerificationAt: new Date(),
          },
        }
      );

      return NextResponse.json(
        {
          success: false,
          rejected: failed,
          pending: !failed,
          message: failed
            ? "Payment was not completed."
            : "Payment is not confirmed yet. Check its status before trying again.",
        },
        { status: failed ? 402 : 202 }
      );
    }

    // Prevent duplicate finalization for an already-confirmed payment.
    const existingBooking = await bookings.findOne({
      booking_id: paymentRecord.booking_id,
      "payment.payment_id": paymentId,
      status: "confirmed",
    });

    if (existingBooking) {
      await paymentOrders.updateOne(
        { _id: paymentRecord._id },
        {
          $set: {
            status: "confirmed",
            razorpay_payment_id: paymentId,
            verifiedAt: new Date(),
          },
        }
      );

      return NextResponse.json({
        success: true,
        bookingId: paymentRecord.booking_id,
        alreadyConfirmed: true,
        message: "Payment and booking are already confirmed.",
      });
    }

    const session = client.startSession();
    let alreadyConfirmed = false;

    try {
      await session.withTransaction(
        async () => {
          const current = await paymentOrders.findOne(
            { _id: paymentRecord._id },
            { session }
          );

          if (!current) {
            throw new Error("PAYMENT_RECORD_NOT_FOUND");
          }

          // Another retry may have completed the booking.
          const existing = await bookings.findOne(
            { booking_id: current.booking_id },
            { session }
          );

          if (
            existing?.status === "confirmed" &&
            existing?.payment?.payment_id === paymentId
          ) {
            alreadyConfirmed = true;
            return;
          }

          const holds = Array.isArray(current.holds)
            ? current.holds
            : [];

          if (holds.length === 0) {
            throw new Error("NO_PAYMENT_HOLDS");
          }

          const now = new Date();
          const holdIds = holds.map((hold) => hold.roomId);

          const liveHolds = await temporaryBooks
            .find(
              {
                TempID: current.TempID,
                roomId: { $in: holdIds },
                checkIn: holds[0]?.checkIn,
                checkOut: holds[0]?.checkOut,
                expiresAt: { $gt: now },
                status: "active",
              },
              { session }
            )
            .toArray();

          if (liveHolds.length !== holds.length) {
            throw new Error("HOLD_EXPIRED_AFTER_PAYMENT");
          }

          // Ensure no room has already been booked or blocked.
          for (const hold of holds) {
            for (const date of hold.stayDates || []) {
              const record = await availability.findOne(
                { date },
                { session }
              );

              if (
                (record?.booked_rooms || []).includes(hold.roomId) ||
                (record?.blocked_rooms || []).includes(hold.roomId)
              ) {
                throw new Error("ROOM_NO_LONGER_AVAILABLE");
              }
            }
          }

          const customer = current.customer || {};
          const addons = current.addons || {};
          const quote = current.quote || {};

          const booking = {
            booking_id: current.booking_id,

            personal_info: {
              name: customer.name || "",
              email: customer.email || "",
              phone_number: customer.phone || "",
              aadhar_number: customer.aadhar_number || "",
              address: customer.address || "",
              pin_code: customer.pin_code || "",
              city: customer.city || "",
              special_request: customer.special_request || "",
            },

            check_in: holds[0]?.checkIn || "",
            check_out: holds[0]?.checkOut || "",
            nights: quote.nights || 1,
            rooms: quote.rooms || [],

            dinner: ["dinner", "lunchDinner"].includes(
              addons.mealPlan
            )
              ? addons.mealGuests || 0
              : 0,

            lunch: ["lunch", "lunchDinner"].includes(
              addons.mealPlan
            )
              ? addons.mealGuests || 0
              : 0,

            driver: {
              accommodation:
                Number(addons.drivers) > 0 ? "yes" : "no",
              dinner: ["dinner", "lunchDinner"].includes(
                addons.driverMealPlan
              )
                ? "yes"
                : "no",
            },

            terms_conditions: "yes",
            paid_amount: current.amount_paise / 100,
            pricing: quote,

            payment: {
              provider: "razorpay",
              order_id: orderId,
              payment_id: paymentId,
              status: "captured",
              currency: "INR",
              captured_at: new Date(),
            },

            status: "confirmed",
            created_at: new Date(),
          };

          // Save the confirmed booking.
          await bookings.updateOne(
            { booking_id: current.booking_id },
            { $setOnInsert: booking },
            { upsert: true, session }
          );

          // Finalize each held room for every night.
          // Initialize the date document separately. Do not put
          // booked_rooms in $setOnInsert and $addToSet together.
          for (const hold of holds) {
            for (const date of hold.stayDates || []) {
              await availability.updateOne(
                { date },
                {
                  $setOnInsert: {
                    date,
                    blocked_rooms: [],
                  },
                },
                {
                  upsert: true,
                  session,
                }
              );

              await availability.updateOne(
                { date },
                {
                  $addToSet: {
                    booked_rooms: hold.roomId,
                  },
                  $pull: {
                    temporary_holds: {
                      TempID: current.TempID,
                      roomId: hold.roomId,
                    },
                  },
                },
                { session }
              );
            }

            await temporaryBooks.deleteOne(
              {
                TempID: current.TempID,
                roomId: hold.roomId,
                checkIn: hold.checkIn,
                checkOut: hold.checkOut,
              },
              { session }
            );
          }

          // Mark payment confirmed only within the same transaction.
          await paymentOrders.updateOne(
            { _id: current._id },
            {
              $set: {
                status: "confirmed",
                razorpay_payment_id: paymentId,
                verifiedAt: new Date(),
              },
            },
            { session }
          );
        },
        {
          readConcern: { level: "snapshot" },
          writeConcern: { w: "majority" },
          readPreference: "primary",
        }
      );
    } finally {
      await session.endSession();
    }

    return NextResponse.json({
      success: true,
      bookingId: paymentRecord.booking_id,
      alreadyConfirmed,
      message: "Payment verified and booking confirmed.",
    });
  } catch (error) {
    console.error(
      "Payment verification/finalization failed:",
      error
    );

    const conflict = [
      "HOLD_EXPIRED_AFTER_PAYMENT",
      "ROOM_NO_LONGER_AVAILABLE",
    ].includes(error.message);

    return fail(
      conflict
        ? "Payment was received, but the room could not be confirmed automatically. Contact support; do not pay again."
        : "We could not finish verifying this payment. Check payment status before trying again.",
      conflict ? 409 : 500,
      { pending: true }
    );
  }
}
