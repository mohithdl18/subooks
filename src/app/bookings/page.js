
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ToolBar from "@/components/Bookings/ToolBar";
import RoomsCard from "@/components/Bookings/RoomsCard";
import PackagesCard from "@/components/Bookings/PackagesCard";
import Cart from "@/components/Bookings/Cart";
import { getAvailablePackages } from "@/logic/packageAvailability";

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

  const toolbarRef = useRef(null);
  const requestIdRef = useRef(0);

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

      setDates({ checkIn, checkOut });

      // Package mode does not require a separate availability fetch.
      if (mode === "packages") {
        setView("packages");
        return;
      }

      const requestId = ++requestIdRef.current;

      setIsCheckingAvailability(true);
      setAvailabilityError("");
      setAvailableRoomIds(null);

      // Clear previous selections when the dates change.
      setSelectedRoomIds([]);
      setSelectedRoomData([]);
      setSelectedPackageIds([]);

      try {
        const response = await fetch("/api/availability", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ checkIn, checkOut }),
        });

        const result = await response.json();

        // Ignore outdated responses.
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
    []
  );

  // Automatically check availability for today and tomorrow on page load.
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

  // Select or deselect a room and store its complete pricing details.
  function handleRoomSelection(room) {
    if (!room || !room.id) return;

    const isSelected = selectedRoomIds.includes(room.id);

    if (isSelected) {
      setSelectedRoomIds((previous) =>
        previous.filter((id) => id !== room.id)
      );

      setSelectedRoomData((previous) =>
        previous.filter((item) => item.id !== room.id)
      );
    } else {
      setSelectedRoomIds((previous) => [...previous, room.id]);

      setSelectedRoomData((previous) => [
        ...previous.filter((item) => item.id !== room.id),
        room,
      ]);
    }

    // Rooms and packages cannot be selected together.
    setSelectedPackageIds([]);
  }

  // Synchronize room occupancy and price immediately after each + / - click.
  function handleRoomOccupancyChange(updatedRoom) {
    if (!updatedRoom || !selectedRoomIds.includes(updatedRoom.id)) {
      return;
    }

    setSelectedRoomData((previous) =>
      previous.map((room) =>
        room.id === updatedRoom.id ? updatedRoom : room
      )
    );
  }

  function handlePackageSelection(pkg) {
    setSelectedPackageIds((previous) =>
      previous.includes(pkg.id)
        ? previous.filter((id) => id !== pkg.id)
        : [...previous, pkg.id]
    );

    // Clear selected rooms and their stored pricing when switching to packages.
    setSelectedRoomIds([]);
    setSelectedRoomData([]);
  }

  // Clear all room and package selections from the cart.
  function handleClearCart() {
    setSelectedRoomIds([]);
    setSelectedRoomData([]);
    setSelectedPackageIds([]);
  }

  const handleViewChange = (newMode) => {
    setView(newMode);
    setAvailabilityError("");

    // Ensure availability is loaded before displaying packages.
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

  const nights = calculateNights(dates.checkIn, dates.checkOut);
  const availablePackages = getAvailablePackages(availableRoomIds);

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

        {/* Sticky toolbar */}
        <div ref={toolbarRef}>
          <div
            className={
              isFixed ? "fixed top-[10px] left-0 right-0 z-50" : ""
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
                  <h2 className="text-2xl font-semibold">Our Rooms</h2>

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
                  <p className="text-sm font-medium">
                    {selectedRoomIds.length}{" "}
                    {selectedRoomIds.length === 1 ? "room" : "rooms"} selected
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
              ) : availableRoomIds !== null &&
                availableRoomIds.length === 0 ? (
                <div
                  className="rounded-2xl border p-8 text-center"
                  style={{
                    backgroundColor: "#ffffff",
                    borderColor: "rgba(5, 42, 80, 0.12)",
                  }}
                >
                  <h3 className="text-xl font-semibold">
                    No rooms available
                  </h3>

                  <p className="mt-2 text-sm opacity-70">
                    Please choose different dates to find an available room.
                  </p>
                </div>
              ) : (
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
                <h2 className="text-2xl font-semibold">Stay Packages</h2>

                <p className="mt-1 text-sm opacity-70">
                  Packages are shown only when all rooms included in a package
                  are available for your selected dates.
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
                  Checking availability is required before packages can be
                  displayed.
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
                    The rooms required for these packages are not all available
                    for your selected dates. Try different dates or view
                    individual rooms.
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

      {/* Floating cart available throughout the booking page */}
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
