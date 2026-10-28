
import { NextResponse } from "next/server";
import { getAvailabilityByDateRange } from "@/data/room_availabilty";
import rooms from "@/data/rooms.json";

// export const runtime = "nodejs";

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
    const { checkIn, checkOut } = body;

    if (!isValidDateString(checkIn) || !isValidDateString(checkOut)) {
      return NextResponse.json(
        { success: false, message: "Please provide valid check-in and checkout dates." },
        { status: 400 }
      );
    }

    const nights = getNights(checkIn, checkOut);

    if (nights < 1 || nights > 10) {
      return NextResponse.json(
        { success: false, message: "Your stay must be between 1 and 10 nights." },
        { status: 400 }
      );
    }

    const stayDates = getStayDates(checkIn, checkOut);

    // Fetch availability records for the selected date range.
    const availabilityRecords = await getAvailabilityByDateRange(
      checkIn,
      checkOut
    );

    const bookedRoomsByDate = new Map(
      availabilityRecords.map((record) => [
        record.date,
        Array.isArray(record.booked_rooms) ? record.booked_rooms : [],
      ])
    );

    // A room must be available on every night of the stay.
    const availableRooms = rooms.filter((room) =>
      stayDates.every((date) => {
        const bookedRooms = bookedRoomsByDate.get(date) || [];
        return !bookedRooms.includes(room.id);
      })
    );

    const availableRoomIds = availableRooms.map((room) => room.id);

    return NextResponse.json({
      success: true,
      checkIn,
      checkOut,
      nights,
      availableRoomIds,
      availableRooms,
      unavailableRoomIds: rooms
        .filter((room) => !availableRoomIds.includes(room.id))
        .map((room) => room.id),
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
