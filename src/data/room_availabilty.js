
import "server-only";
import { getDb } from "@/lib/mongodb";

const COLLECTION = "room_availabilty";

// Retrieve all availability records.
export async function getAllAvailability() {
  const db = await getDb();

  return db.collection(COLLECTION).find({}).sort({ date: 1 }).toArray();
}

// Retrieve availability for a particular date.
export async function getAvailabilityByDate(date) {
  const db = await getDb();

  return db.collection(COLLECTION).findOne({ date });
}

// Retrieve availability records within a date range.
// Dates use YYYY-MM-DD format.
export async function getAvailabilityByDateRange(startDate, endDate) {
  const db = await getDb();

  return db
    .collection(COLLECTION)
    .find({
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    })
    .sort({ date: 1 })
    .toArray();
}

// Retrieve the booked rooms for a particular date.
// If no record exists, return an empty array.
export async function getBookedRooms(date) {
  const availability = await getAvailabilityByDate(date);

  return availability?.booked_rooms ?? [];
}
