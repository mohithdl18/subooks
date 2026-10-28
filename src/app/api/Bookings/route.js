import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

// A booking is created only by /api/payments/verify after Razorpay verification.
// This route is for retrieving a booking by ID; protect it with auth before production.
export async function GET(request) {
  try {
    const bookingId = new URL(request.url).searchParams.get("bookingId");
    if (!bookingId || bookingId.length > 100) {
      return NextResponse.json({ success: false, message: "Valid bookingId required." }, { status: 400 });
    }
    const db = await getDb();
    const booking = await db.collection("bookings_data").findOne(
      { booking_id: bookingId },
      { projection: { _id: 0, booking_id: 1, status: 1, paid_amount: 1, personal_info: 1, check_in: 1, check_out: 1, rooms: 1, created_at: 1 } }
    );
    if (!booking) return NextResponse.json({ success: false, message: "Booking not found." }, { status: 404 });
    return NextResponse.json({ success: true, booking });
  } catch (error) {
    console.error("Booking lookup failed:", error);
    return NextResponse.json({ success: false, message: "Unable to retrieve booking." }, { status: 500 });
  }
}
