
import { NextResponse } from "next/server";
import { getDb, clientPromise } from "@/lib/mongodb";
import rooms from "@/data/rooms.json";

const HOLD_DURATION_MS = 10 * 60 * 1000;
const AVAILABILITY_COLLECTION = "room_availabilty";
const TEMP_COLLECTION = "temp_books";

function isValidDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
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

function isValidTempID(value) {
    return (
        typeof value === "string" &&
        value.trim().length > 0 &&
        value.length <= 150
    );
}

function getTodayString() {
    const today = new Date();

    return [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
    ].join("-");
}

function isActiveHold(hold) {
    const expiry = new Date(hold?.expiresAt).getTime();

    return Number.isFinite(expiry) && expiry > Date.now();
}

/**
 * Remove expired temp_books records and their corresponding
 * room-specific temporary_holds entries.
 */
async function cleanExpiredHolds(db) {
    const tempCollection = db.collection(TEMP_COLLECTION);
    const availabilityCollection = db.collection(AVAILABILITY_COLLECTION);
    const client = await clientPromise;

    const expiredHolds = await tempCollection
        .find({ expiresAt: { $lte: new Date() } })
        .toArray();

    for (const hold of expiredHolds) {
        const session = client.startSession();

        try {
            await session.withTransaction(async () => {
                const currentHold = await tempCollection.findOne(
                    {
                        _id: hold._id,
                        expiresAt: { $lte: new Date() },
                    },
                    { session }
                );

                if (!currentHold) return;

                await tempCollection.deleteOne(
                    { _id: currentHold._id },
                    { session }
                );

                for (const date of currentHold.stayDates || []) {
                    await availabilityCollection.updateOne(
                        { date },
                        {
                            $pull: {
                                temporary_holds: {
                                    TempID: currentHold.TempID,
                                    roomId: currentHold.roomId,
                                },
                            },
                        },
                        { session }
                    );
                }
            });
        } finally {
            await session.endSession();
        }
    }
}

/**
 * Find an active hold by another TempID that overlaps at least one
 * night of this requested stay.
 *
 * The temp_books query is authoritative for active temporary holds.
 * This also catches conflicts if a temporary_holds entry is missing
 * from room_availabilty.
 */
async function findConflictingHold(
    tempCollection,
    { TempID, roomId, stayDates },
    session
) {
    const conflicts = await tempCollection
        .find(
            {
                roomId,
                TempID: { $ne: TempID },
                expiresAt: { $gt: new Date() },
                stayDates: { $in: stayDates },
            },
            {
                ...(session ? { session } : {}),
                projection: {
                    _id: 0,
                    TempID: 1,
                    roomId: 1,
                    stayDates: 1,
                    expiresAt: 1,
                },
            }
        )
        .toArray();

    return conflicts.find(
        (hold) =>
            hold.TempID !== TempID &&
            isActiveHold(hold) &&
            (hold.stayDates || []).some((date) => stayDates.includes(date))
    );
}

export async function POST(request) {
    let session;

    try {
        const body = await request.json();
        const { TempID, roomId, checkIn, checkOut } = body;

        if (
            !isValidTempID(TempID) ||
            typeof roomId !== "string" ||
            !rooms.some((room) => room.id === roomId) ||
            !isValidDate(checkIn) ||
            !isValidDate(checkOut) ||
            checkOut <= checkIn
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid temporary booking details.",
                },
                { status: 400 }
            );
        }

        const stayDates = getStayDates(checkIn, checkOut);

        if (stayDates.length < 1 || stayDates.length > 10) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Your stay must be between 1 and 10 nights.",
                },
                { status: 400 }
            );
        }

        if (checkIn < getTodayString()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Check-in cannot be in the past.",
                },
                { status: 400 }
            );
        }

        const db = await getDb();
        const tempCollection = db.collection(TEMP_COLLECTION);
        const availabilityCollection = db.collection(
            AVAILABILITY_COLLECTION
        );
        const client = await clientPromise;

        await cleanExpiredHolds(db);

        // First, detect a conflicting hold stored in temp_books.
        const conflictingHold = await findConflictingHold(tempCollection, {
            TempID,
            roomId,
            stayDates,
        });

        if (conflictingHold) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "This room is temporarily held by another customer for some or all of those dates. Please choose another room or dates.",
                },
                { status: 409 }
            );
        }

        // Allow an existing hold for this same room and exact date range
        // to be reused without extending its expiry.
        const existingRoomHolds = await tempCollection
            .find({
                TempID,
                roomId,
                expiresAt: { $gt: new Date() },
            })
            .toArray();

        const existingHold = existingRoomHolds.find(
            (hold) =>
                hold.checkIn === checkIn &&
                hold.checkOut === checkOut &&
                isActiveHold(hold)
        );

        if (existingHold) {
            return NextResponse.json({
                success: true,
                TempID,
                roomId,
                checkIn,
                checkOut,
                expiresAt: existingHold.expiresAt,
                remainingSeconds: Math.max(
                    0,
                    Math.ceil(
                        (new Date(existingHold.expiresAt).getTime() -
                            Date.now()) /
                            1000
                    )
                ),
                message: "Your room is already temporarily held.",
            });
        }

        // One TempID cannot hold the same room for a different date range.
        if (existingRoomHolds.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "This room is already held for different dates in your temporary booking.",
                },
                { status: 409 }
            );
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + HOLD_DURATION_MS);

        session = client.startSession();

        await session.withTransaction(async () => {
            // Recheck the authoritative temporary-hold collection
            // inside the transaction to reduce race conditions.
            const transactionConflict = await findConflictingHold(
                tempCollection,
                { TempID, roomId, stayDates },
                session
            );

            if (transactionConflict) {
                throw new Error("ROOM_UNAVAILABLE");
            }

            // Check each night for confirmed bookings, admin blocks,
            // and active holds written to the daily availability records.
            for (const date of stayDates) {
                const record = await availabilityCollection.findOne(
                    { date },
                    { session }
                );

                const bookedRooms = Array.isArray(record?.booked_rooms)
                    ? record.booked_rooms
                    : [];

                const blockedRooms = Array.isArray(record?.blocked_rooms)
                    ? record.blocked_rooms
                    : [];

                const temporaryHolds = Array.isArray(
                    record?.temporary_holds
                )
                    ? record.temporary_holds
                    : [];

                const heldByAnotherCustomer = temporaryHolds.some(
                    (hold) =>
                        hold.roomId === roomId &&
                        hold.TempID !== TempID &&
                        isActiveHold(hold)
                );

                if (
                    bookedRooms.includes(roomId) ||
                    blockedRooms.includes(roomId) ||
                    heldByAnotherCustomer
                ) {
                    throw new Error("ROOM_UNAVAILABLE");
                }
            }

            // Save the hold with the exact dates and expiry timestamp.
            await tempCollection.insertOne(
                {
                    TempID,
                    roomId,
                    roomName:
                        rooms.find((room) => room.id === roomId)?.name ||
                        roomId,
                    checkIn,
                    checkOut,
                    stayDates,
                    createdAt: now,
                    expiresAt,
                    status: "active",
                },
                { session }
            );

            // Mirror the hold into each night's availability record.
            for (const date of stayDates) {
                await availabilityCollection.updateOne(
                    { date },
                    {
                        $setOnInsert: {
                            date,
                            booked_rooms: [],
                            blocked_rooms: [],
                        },
                        $addToSet: {
                            temporary_holds: {
                                TempID,
                                roomId,
                                expiresAt,
                            },
                        },
                    },
                    { upsert: true, session }
                );
            }
        });

        return NextResponse.json(
            {
                success: true,
                TempID,
                roomId,
                checkIn,
                checkOut,
                expiresAt,
                remainingSeconds: 600,
                message: "Room held for 10 minutes.",
            },
            { status: 201 }
        );
    } catch (error) {
        if (
            error.message === "ROOM_UNAVAILABLE" ||
            error.code === 11000
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "This room is no longer available for those dates. Please search again.",
                },
                { status: 409 }
            );
        }

        console.error("Temporary room hold failed:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Unable to hold this room. Please try again.",
            },
            { status: 500 }
        );
    } finally {
        if (session) {
            await session.endSession();
        }
    }
}

export async function DELETE(request) {
    let session;

    try {
        const body = await request.json();
        const { TempID, roomId } = body;

        if (
            !isValidTempID(TempID) ||
            (roomId != null &&
                (typeof roomId !== "string" ||
                    !rooms.some((room) => room.id === roomId)))
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "A valid TempID and optional roomId are required.",
                },
                { status: 400 }
            );
        }

        const db = await getDb();
        const tempCollection = db.collection(TEMP_COLLECTION);
        const availabilityCollection = db.collection(
            AVAILABILITY_COLLECTION
        );
        const client = await clientPromise;

        session = client.startSession();

        let releasedCount = 0;

        await session.withTransaction(async () => {
            const filter = {
                TempID,
                ...(roomId ? { roomId } : {}),
            };

            const holds = await tempCollection
                .find(filter, { session })
                .toArray();

            if (holds.length === 0) return;

            await tempCollection.deleteMany(filter, { session });

            for (const hold of holds) {
                for (const date of hold.stayDates || []) {
                    await availabilityCollection.updateOne(
                        { date },
                        {
                            $pull: {
                                temporary_holds: {
                                    TempID: hold.TempID,
                                    roomId: hold.roomId,
                                },
                            },
                        },
                        { session }
                    );
                }
            }

            releasedCount = holds.length;
        });

        return NextResponse.json({
            success: true,
            releasedCount,
            message:
                releasedCount > 0
                    ? "Temporary room hold released."
                    : "No matching temporary holds were found.",
        });
    } catch (error) {
        console.error("Temporary room hold release failed:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Unable to release the temporary hold.",
            },
            { status: 500 }
        );
    } finally {
        if (session) {
            await session.endSession();
        }
    }
}

export async function GET() {
    try {
        const db = await getDb();
        await cleanExpiredHolds(db);

        return NextResponse.json({
            success: true,
            message: "Expired temporary holds cleaned up.",
        });
    } catch (error) {
        console.error("Temporary hold cleanup failed:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Unable to clean expired holds.",
            },
            { status: 500 }
        );
    }
}
