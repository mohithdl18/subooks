
import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getAvailabilityByDateRange } from "@/data/room_availabilty";
import rooms from "@/data/rooms.json";

function isValidDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function getNights(checkIn, checkOut) {
  const start = new Date(`${checkIn}T00:00:00.000Z`);
  const end = new Date(`${checkOut}T00:00:00.000Z`);

  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

function getStayDates(checkIn, checkOut) {
  const dates = [];
  const current = new Date(`${checkIn}T00:00:00.000Z`);
  const end = new Date(`${checkOut}T00:00:00.000Z`);

  while (current < end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { checkIn, checkOut, TempID } = body;

    if (
      !isValidDateString(checkIn) ||
      !isValidDateString(checkOut)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Please provide valid check-in and checkout dates.",
        },
        { status: 400 }
      );
    }

    const nights = getNights(checkIn, checkOut);

    if (nights < 1 || nights > 10) {
      return NextResponse.json(
        {
          success: false,
          message: "Your stay must be between 1 and 10 nights.",
        },
        { status: 400 }
      );
    }

    const stayDates = getStayDates(checkIn, checkOut);
    const now = new Date();

    const [availabilityRecords, db] = await Promise.all([
      getAvailabilityByDateRange(checkIn, checkOut),
      getDb(),
    ]);

    const availabilityByDate = new Map(
      availabilityRecords.map((record) => [
        record.date,
        {
          bookedRooms: Array.isArray(record.booked_rooms)
            ? record.booked_rooms
            : [],
          blockedRooms: Array.isArray(record.blocked_rooms)
            ? record.blocked_rooms
            : [],
          temporaryHolds: Array.isArray(record.temporary_holds)
            ? record.temporary_holds
            : [],
        },
      ])
    );

    // Also read active holds directly from temp_books.
    // This protects availability even if a per-date hold entry is missing.
    const activeHolds = await db
      .collection("temp_books")
      .find({
        expiresAt: { $gt: now },
        stayDates: { $in: stayDates },
      })
      .project({
        _id: 0,
        TempID: 1,
        roomId: 1,
        expiresAt: 1,
        stayDates: 1,
      })
      .toArray();

    const availableRooms = rooms.filter((room) =>
      stayDates.every((date) => {
        const record = availabilityByDate.get(date);

        if (record) {
          if (
            record.bookedRooms.includes(room.id) ||
            record.blockedRooms.includes(room.id)
          ) {
            return false;
          }

          const heldInAvailability = record.temporaryHolds.some(
            (hold) => {
              if (hold.roomId !== room.id) return false;

              const expiresAt = new Date(hold.expiresAt).getTime();

              if (
                !Number.isFinite(expiresAt) ||
                expiresAt <= Date.now()
              ) {
                return false;
              }

              // A customer can see their own temporary hold.
              return !TempID || hold.TempID !== TempID;
            }
          );

          if (heldInAvailability) return false;
        }

        // A different TempID holding this room for any night
        // makes the room unavailable for the requested stay.
        const heldInTempBooks = activeHolds.some((hold) => {
          if (hold.roomId !== room.id) return false;

          if (TempID && hold.TempID === TempID) {
            return false;
          }

          const expiresAt = new Date(hold.expiresAt).getTime();

          if (
            !Number.isFinite(expiresAt) ||
            expiresAt <= Date.now()
          ) {
            return false;
          }

          return Array.isArray(hold.stayDates)
            ? hold.stayDates.includes(date)
            : false;
        });

        return !heldInTempBooks;
      })
    );

    const availableRoomIds = availableRooms.map((room) => room.id);

    const unavailableRoomIds = rooms
      .filter((room) => !availableRoomIds.includes(room.id))
      .map((room) => room.id);

    return NextResponse.json({
      success: true,
      checkIn,
      checkOut,
      nights,
      availableRoomIds,
      availableRooms,
      unavailableRoomIds,
      message:
        availableRooms.length > 0
          ? "Availability checked successfully."
          : "Sorry, no rooms are available for these dates.",
    });
  } catch (error) {
    console.error("Availability check failed:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          process.env.NODE_ENV === "development"
            ? error.message || "Unknown availability error"
            : "Unable to check availability. Please try again.",
      },
      { status: 500 }
    );
  }
}
