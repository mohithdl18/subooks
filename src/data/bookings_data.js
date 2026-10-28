
import "server-only";
import { getDb } from "@/lib/mongodb";

const COLLECTION = "bookings_data";

// Retrieve all bookings.
export async function getAllBookings() {
  const db = await getDb();

  return db
    .collection(COLLECTION)
    .find({})
    .sort({ _id: -1 })
    .toArray();
}

// Retrieve a booking using its booking ID.
export async function getBookingById(bookingId) {
  const db = await getDb();

  return db.collection(COLLECTION).findOne({
    booking_id: bookingId,
  });
}

// Retrieve bookings by status.
export async function getBookingsByStatus(status) {
  const db = await getDb();

  return db
    .collection(COLLECTION)
    .find({ status })
    .sort({ _id: -1 })
    .toArray();
}

// Retrieve bookings belonging to a particular email address.
export async function getBookingsByEmail(email) {
  const db = await getDb();

  return db
    .collection(COLLECTION)
    .find({
      "personal_info.email": email,
    })
    .sort({ _id: -1 })
    .toArray();
}

// Count all bookings.
export async function getBookingCount() {
  const db = await getDb();

  return db.collection(COLLECTION).countDocuments();
}
