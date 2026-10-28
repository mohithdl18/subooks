
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ToolBar from "@/components/Bookings/ToolBar";
import RoomsCard from "@/components/Bookings/RoomsCard";
import PackagesCard from "@/components/Bookings/PackagesCard";
import Cart from "@/components/Bookings/Cart";
import { getAvailablePackages } from "@/logic/packageAvailability";
import {
  initializeTempID,
  updateBookingDates,
  updateBookingRooms,
  startTemporaryHold,
  clearHoldExpiry,
} from "@/logic/Data";

const TEMP_HOLD_DURATION_MS = 10 * 60 * 1000;

function calculateNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 1;

  const start = new Date(`${checkIn}T00:00:00.000Z`);
  const end = new Date(`${checkOut}T00:00:00.000Z`);

  return Math.max(
    1,
    Math.round((end - start) / (24 * 60 * 60 * 1000))
  );
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function BookingsPage() {
  const [dates, setDates] = useState({
    checkIn: "",
    checkOut: "",
  });

  const [view, setView] = useState("rooms");
  const [selectedRoomIds, setSelectedRoomIds] = useState([]);
  const [selectedRoomData, setSelectedRoomData] = useState([]);
  const [selectedPackageIds, setSelectedPackageIds] = useState([]);

  const [availableRoomIds, setAvailableRoomIds] = useState(null);
  const [isCheckingAvailability, setIsCheckingAvailability] =
    useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [isFixed, setIsFixed] = useState(false);

  // Each selected room has its own server-confirmed expiry timestamp.
  const [holdExpiries, setHoldExpiries] = useState({});
  const [remainingHoldTime, setRemainingHoldTime] = useState(0);
  const [holdError, setHoldError] = useState("");
  const [isSelectingRoom, setIsSelectingRoom] = useState(false);

  const toolbarRef = useRef(null);
  const requestIdRef = useRef(0);
  const tempIDRef = useRef(null);
  const selectedRoomIdsRef = useRef([]);
  const holdExpiriesRef = useRef({});
  const datesRef = useRef(dates);
  const isMountedRef = useRef(false);
  const selectionLocksRef = useRef(new Set());

  useEffect(() => {
    tempIDRef.current = initializeTempID();
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    selectedRoomIdsRef.current = selectedRoomIds;
  }, [selectedRoomIds]);

  useEffect(() => {
    holdExpiriesRef.current = holdExpiries;
  }, [holdExpiries]);

  useEffect(() => {
    datesRef.current = dates;
  }, [dates]);

  // Keep the shared booking data synchronized.
  useEffect(() => {
    if (dates.checkIn && dates.checkOut) {
      updateBookingDates(dates.checkIn, dates.checkOut);
    }
  }, [dates.checkIn, dates.checkOut]);

  useEffect(() => {
    updateBookingRooms(selectedRoomData);
  }, [selectedRoomData]);

  // Release temporary holds through the server.
  // Pass roomId to release one room, or omit it to release all rooms.
  const releaseTemporaryHolds = useCallback(async (roomId = null) => {
    const tempID = tempIDRef.current || initializeTempID();

    try {
      const response = await fetch("/api/Bookings/TempBooks", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          TempID: tempID,
          ...(roomId ? { roomId } : {}),
        }),
        keepalive: true,
      });

      if (!response.ok) {
        console.error("Unable to release temporary room hold.");
      }
    } catch (error) {
      console.error("Temporary hold release failed:", error);
    }
  }, []);

  // Keep the toolbar's existing sticky behavior.
  useEffect(() => {
    function handleScroll() {
      if (!toolbarRef.current) return;

      const top = toolbarRef.current.getBoundingClientRect().top;
      setIsFixed(top <= 10);
    }

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleAvailabilitySearch = useCallback(
    async ({ checkIn, checkOut, mode } = {}) => {
      if (!checkIn || !checkOut || checkOut <= checkIn) {
        setAvailabilityError(
          "Please select a valid check-in and check-out date."
        );
        return;
      }

      const previousDates = datesRef.current;

      const datesChanged =
        previousDates.checkIn !== checkIn ||
        previousDates.checkOut !== checkOut;

      // Release previous holds when the stay dates change.
      if (
        datesChanged &&
        Object.keys(holdExpiriesRef.current).length > 0
      ) {
        await releaseTemporaryHolds();

        if (!isMountedRef.current) return;

        setSelectedRoomIds([]);
        setSelectedRoomData([]);
        selectedRoomIdsRef.current = [];
        setHoldExpiries({});
        holdExpiriesRef.current = {};
        setRemainingHoldTime(0);
        clearHoldExpiry();
      }

      setDates({ checkIn, checkOut });
      datesRef.current = { checkIn, checkOut };

      updateBookingDates(checkIn, checkOut);

      if (mode === "packages") {
        setView("packages");
        return;
      }

      const requestId = ++requestIdRef.current;

      setIsCheckingAvailability(true);
      setAvailabilityError("");
      setHoldError("");
      setAvailableRoomIds(null);

      // Changing dates invalidates selected rooms and packages.
      if (datesChanged) {
        setSelectedRoomIds([]);
        setSelectedRoomData([]);
        setSelectedPackageIds([]);
        selectedRoomIdsRef.current = [];
      }

      try {
        const tempID = tempIDRef.current || initializeTempID();

        const response = await fetch("/api/availability", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            checkIn,
            checkOut,
            TempID: tempID,
          }),
        });

        const result = await response.json();

        if (requestId !== requestIdRef.current) return;

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Unable to check room availability."
          );
        }

        setAvailableRoomIds(
          Array.isArray(result.availableRoomIds)
            ? result.availableRoomIds
            : []
        );
      } catch (error) {
        if (requestId !== requestIdRef.current) return;

        console.error("Availability check failed:", error);

        setAvailabilityError(
          error.message ||
            "Unable to check availability. Please try again."
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setIsCheckingAvailability(false);
        }
      }
    },
    [releaseTemporaryHolds]
  );

  // Load today's and tomorrow's availability on the first visit.
  useEffect(() => {
    const today = new Date();
    const tomorrow = new Date(today);

    tomorrow.setDate(tomorrow.getDate() + 1);

    handleAvailabilitySearch({
      checkIn: formatLocalDate(today),
      checkOut: formatLocalDate(tomorrow),
      mode: "rooms",
    });

    return () => {
      requestIdRef.current += 1;
    };
  }, [handleAvailabilitySearch]);

  // Update the countdown using the earliest expiry among selected rooms.
  useEffect(() => {
    function updateCountdown() {
      const expiries = Object.values(holdExpiriesRef.current);

      if (expiries.length === 0) {
        setRemainingHoldTime(0);
        return;
      }

      const earliestExpiry = Math.min(...expiries.map(Number));

      setRemainingHoldTime(
        Math.max(0, earliestExpiry - Date.now())
      );
    }

    updateCountdown();

    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [holdExpiries]);

  // Release holds only when their actual expiry timestamp has passed.
  useEffect(() => {
    const expiryValues = Object.values(holdExpiries);

    if (expiryValues.length === 0) return;

    const earliestExpiry = Math.min(
      ...expiryValues.map(Number)
    );

    if (!Number.isFinite(earliestExpiry)) {
      console.error("Invalid temporary hold expiry timestamp.");
      return;
    }

    if (Date.now() < earliestExpiry) return;

    let cancelled = false;

    async function expireSelection() {
      await releaseTemporaryHolds();

      if (cancelled || !isMountedRef.current) return;

      setSelectedRoomIds([]);
      setSelectedRoomData([]);
      selectedRoomIdsRef.current = [];

      setHoldExpiries({});
      holdExpiriesRef.current = {};

      setRemainingHoldTime(0);
      clearHoldExpiry();

      setHoldError(
        "Your 10-minute room hold has expired. Please select your room again."
      );
    }

    expireSelection();

    return () => {
      cancelled = true;
    };
  }, [
    remainingHoldTime,
    holdExpiries,
    releaseTemporaryHolds,
  ]);

  // Release holds when the tab is refreshed or closed.
  // Server-side expiry remains the fallback.
  useEffect(() => {
    function handlePageHide() {
      if (Object.keys(holdExpiriesRef.current).length === 0) {
        return;
      }

      const tempID = tempIDRef.current;

      if (!tempID) return;

      fetch("/api/Bookings/TempBooks", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          TempID: tempID,
        }),
        keepalive: true,
      }).catch(() => {
        // Server-side expiry will release abandoned holds.
      });
    }

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  // Select or deselect a room.
  // The backend must confirm every new temporary hold.
  async function handleRoomSelection(room) {
    if (
      !room?.id ||
      !datesRef.current.checkIn ||
      !datesRef.current.checkOut
    ) {
      return;
    }

    const roomId = room.id;
    const isSelected = selectedRoomIdsRef.current.includes(roomId);

    if (selectionLocksRef.current.has(roomId)) return;

    selectionLocksRef.current.add(roomId);
    setIsSelectingRoom(true);
    setHoldError("");

    try {
      if (isSelected) {
        await releaseTemporaryHolds(roomId);

        if (!isMountedRef.current) return;

        setSelectedRoomIds((previous) =>
          previous.filter((id) => id !== roomId)
        );

        setSelectedRoomData((previous) =>
          previous.filter((item) => item.id !== roomId)
        );

        const remainingExpiries = {
          ...holdExpiriesRef.current,
        };

        delete remainingExpiries[roomId];

        holdExpiriesRef.current = remainingExpiries;
        setHoldExpiries(remainingExpiries);

        setSelectedPackageIds([]);

        selectedRoomIdsRef.current =
          selectedRoomIdsRef.current.filter(
            (id) => id !== roomId
          );

        if (Object.keys(remainingExpiries).length === 0) {
          setRemainingHoldTime(0);
          clearHoldExpiry();
        } else {
          startTemporaryHold(
            Math.min(...Object.values(remainingExpiries))
          );
        }

        return;
      }

      // Prevent selecting rooms that the latest availability result
      // marks as unavailable. The backend also validates the hold.
      if (
        availableRoomIds !== null &&
        !availableRoomIds.includes(roomId)
      ) {
        setHoldError(
          "This room is no longer available for your selected dates. Please check availability again."
        );
        return;
      }

      const tempID = tempIDRef.current || initializeTempID();

      const response = await fetch("/api/Bookings/TempBooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          TempID: tempID,
          roomId,
          checkIn: datesRef.current.checkIn,
          checkOut: datesRef.current.checkOut,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            "Unable to reserve this room temporarily."
        );
      }

      if (!isMountedRef.current) return;

      const expiresAt = result.expiresAt
        ? new Date(result.expiresAt).getTime()
        : Date.now() + TEMP_HOLD_DURATION_MS;

      if (
        !Number.isFinite(expiresAt) ||
        expiresAt <= Date.now()
      ) {
        throw new Error(
          "The temporary room hold has expired. Please select the room again."
        );
      }

      setSelectedRoomIds((previous) =>
        previous.includes(roomId)
          ? previous
          : [...previous, roomId]
      );

      setSelectedRoomData((previous) => [
        ...previous.filter((item) => item.id !== roomId),
        room,
      ]);

      selectedRoomIdsRef.current = [
        ...new Set([
          ...selectedRoomIdsRef.current,
          roomId,
        ]),
      ];

      const nextExpiries = {
        ...holdExpiriesRef.current,
        [roomId]: expiresAt,
      };

      holdExpiriesRef.current = nextExpiries;
      setHoldExpiries(nextExpiries);

      startTemporaryHold(
        Math.min(...Object.values(nextExpiries))
      );

      setSelectedPackageIds([]);
    } catch (error) {
      console.error("Room selection failed:", error);

      if (isMountedRef.current) {
        setHoldError(
          error.message ||
            "Unable to hold this room. Please try again."
        );
      }
    } finally {
      selectionLocksRef.current.delete(roomId);

      if (isMountedRef.current) {
        setIsSelectingRoom(
          selectionLocksRef.current.size > 0
        );
      }
    }
  }

  function handleRoomOccupancyChange(updatedRoom) {
    if (
      !updatedRoom ||
      !selectedRoomIds.includes(updatedRoom.id)
    ) {
      return;
    }

    setSelectedRoomData((previous) =>
      previous.map((room) =>
        room.id === updatedRoom.id ? updatedRoom : room
      )
    );
  }

  async function handlePackageSelection(pkg) {
    if (selectedRoomIdsRef.current.length > 0) {
      await releaseTemporaryHolds();
    }

    setSelectedPackageIds((previous) =>
      previous.includes(pkg.id)
        ? previous.filter((id) => id !== pkg.id)
        : [...previous, pkg.id]
    );

    setSelectedRoomIds([]);
    setSelectedRoomData([]);
    selectedRoomIdsRef.current = [];

    setHoldExpiries({});
    holdExpiriesRef.current = {};

    setRemainingHoldTime(0);
    clearHoldExpiry();
  }

  async function handleClearCart() {
    await releaseTemporaryHolds();

    setSelectedRoomIds([]);
    setSelectedRoomData([]);
    setSelectedPackageIds([]);

    selectedRoomIdsRef.current = [];
    setHoldExpiries({});
    holdExpiriesRef.current = {};

    setRemainingHoldTime(0);
    setHoldError("");

    clearHoldExpiry();
    updateBookingRooms([]);
  }

  const handleViewChange = (newMode) => {
    setView(newMode);
    setAvailabilityError("");

    if (
      newMode === "packages" &&
      dates.checkIn &&
      dates.checkOut &&
      availableRoomIds === null &&
      !isCheckingAvailability
    ) {
      handleAvailabilitySearch({
        ...dates,
        mode: "rooms",
      });
    }
  };

  const nights = calculateNights(
    dates.checkIn,
    dates.checkOut
  );

  const availablePackages =
    getAvailablePackages(availableRoomIds);

  return (
    <main
      className="min-h-screen px-4 py-8 sm:px-8 lg:px-12"
      style={{
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1
            className="font-display text-4xl sm:text-5xl"
            style={{ color: "var(--foreground)" }}
          >
            Find Your Stay
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 opacity-75 sm:text-base">
            Choose your dates and discover a peaceful stay surrounded by
            nature at SU VILLA.
          </p>
        </header>

        <div ref={toolbarRef}>
          <div
            className={
              isFixed
                ? "fixed top-[10px] left-0 right-0 z-50"
                : ""
            }
          >
            <ToolBar
              onSearch={handleAvailabilitySearch}
              onModeChange={handleViewChange}
              initialCheckIn={dates.checkIn}
              initialCheckOut={dates.checkOut}
              initialMode={view}
            />
          </div>
        </div>

        <section className="mt-8">
          {view === "rooms" ? (
            <>
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">
                    Our Rooms
                  </h2>

                  <p className="mt-1 text-sm opacity-70">
                    Discover your perfect stay at SU VILLA.
                  </p>

                  {dates.checkIn && dates.checkOut && (
                    <p className="mt-2 text-sm opacity-75">
                      {dates.checkIn} to {dates.checkOut} · {nights}{" "}
                      {nights === 1 ? "night" : "nights"}
                    </p>
                  )}
                </div>

                {selectedRoomIds.length > 0 && (
                  <div className="text-sm font-medium">
                    <p>
                      {selectedRoomIds.length}{" "}
                      {selectedRoomIds.length === 1
                        ? "room"
                        : "rooms"}{" "}
                      selected
                    </p>

                    {remainingHoldTime > 0 && (
                      <p role="timer" className="mt-1">
                        Time remaining:{" "}
                        {formatCountdown(remainingHoldTime)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {holdError && (
                <div
                  className="mb-4 rounded-xl border p-4 text-sm"
                  style={{
                    backgroundColor: "#ffffff",
                    borderColor: "rgba(179, 67, 37, 0.3)",
                  }}
                  role="alert"
                >
                  {holdError}
                </div>
              )}

              {isSelectingRoom && (
                <p
                  className="mb-4 text-sm opacity-70"
                  role="status"
                >
                  Updating your room selection...
                </p>
              )}

              {isCheckingAvailability ? (
                <div
                  className="rounded-2xl border p-8 text-center"
                  style={{
                    backgroundColor: "#ffffff",
                    borderColor: "rgba(5, 42, 80, 0.12)",
                  }}
                  role="status"
                >
                  Checking room availability...
                </div>
              ) : availabilityError ? (
                <div
                  className="rounded-2xl border p-6 text-center"
                  style={{
                    backgroundColor: "#ffffff",
                    borderColor: "rgba(5, 42, 80, 0.15)",
                  }}
                  role="alert"
                >
                  <p>{availabilityError}</p>

                  <button
                    type="button"
                    onClick={() =>
                      handleAvailabilitySearch({
                        ...dates,
                        mode: "rooms",
                      })
                    }
                    className="mt-4 rounded-full px-5 py-2 font-medium"
                    style={{
                      backgroundColor: "var(--accent)",
                      color: "var(--foreground)",
                    }}
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                // Always render every room. RoomsCard handles availability
                // styling and disables rooms not returned by the API.
                <RoomsCard
                  selectedRoomIds={selectedRoomIds}
                  onSelectRoom={handleRoomSelection}
                  onOccupancyChange={handleRoomOccupancyChange}
                  nights={nights}
                  availableRoomIds={availableRoomIds}
                />
              )}
            </>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-semibold">
                  Stay Packages
                </h2>

                <p className="mt-1 text-sm opacity-70">
                  Packages are shown only when all rooms included in a
                  package are available for your selected dates.
                </p>

                {dates.checkIn && dates.checkOut && (
                  <p className="mt-2 text-sm opacity-75">
                    {dates.checkIn} to {dates.checkOut} · {nights}{" "}
                    {nights === 1 ? "night" : "nights"}
                  </p>
                )}
              </div>

              {isCheckingAvailability ? (
                <div
                  className="rounded-2xl border p-8 text-center"
                  style={{
                    backgroundColor: "#ffffff",
                    borderColor: "rgba(5, 42, 80, 0.12)",
                  }}
                  role="status"
                >
                  Checking package availability...
                </div>
              ) : availabilityError ? (
                <div
                  className="rounded-2xl border p-6 text-center"
                  style={{
                    backgroundColor: "#ffffff",
                    borderColor: "rgba(5, 42, 80, 0.15)",
                  }}
                  role="alert"
                >
                  <p>{availabilityError}</p>

                  <button
                    type="button"
                    onClick={() =>
                      handleAvailabilitySearch({
                        ...dates,
                        mode: "rooms",
                      })
                    }
                    className="mt-4 rounded-full px-5 py-2 font-medium"
                    style={{
                      backgroundColor: "var(--accent)",
                      color: "var(--foreground)",
                    }}
                  >
                    Try Again
                  </button>
                </div>
              ) : availableRoomIds === null ? (
                <div
                  className="rounded-2xl border p-8 text-center"
                  style={{
                    backgroundColor: "#ffffff",
                    borderColor: "rgba(5, 42, 80, 0.12)",
                  }}
                >
                  Checking availability is required before packages
                  can be displayed.
                </div>
              ) : availablePackages.length === 0 ? (
                <div
                  className="rounded-2xl border p-8 text-center"
                  style={{
                    backgroundColor: "#ffffff",
                    borderColor: "rgba(5, 42, 80, 0.12)",
                  }}
                >
                  <h3 className="text-xl font-semibold">
                    No packages available
                  </h3>

                  <p className="mt-2 text-sm opacity-70">
                    The rooms required for these packages are not all
                    available for your selected dates. Try different dates
                    or view individual rooms.
                  </p>
                </div>
              ) : (
                <PackagesCard
                  packages={availablePackages}
                  selectedPackageIds={selectedPackageIds}
                  onSelectPackage={handlePackageSelection}
                  nights={nights}
                />
              )}
            </>
          )}
        </section>
      </div>

      <Cart
        selectedRoomIds={selectedRoomIds}
        selectedRoomData={selectedRoomData}
        selectedPackageIds={selectedPackageIds}
        availableRoomIds={availableRoomIds}
        nights={nights}
        onClear={handleClearCart}
      />
    </main>
  );
}

// okayyy