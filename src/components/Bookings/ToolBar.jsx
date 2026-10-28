
"use client";

import { useEffect, useRef, useState } from "react";
import Calendar from "@/components/Bookings/Calendar";

const COLORS = {
    background: "#F7FAEE",
    foreground: "#052a50",
    accent: "#e4b441",
};

function formatDisplayDate(dateString) {
    if (!dateString) return "Select date";

    const [year, month, day] = dateString.split("-").map(Number);

    return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

export default function ToolBar({
    onSearch,
    onModeChange,
    initialCheckIn,
    initialCheckOut,
    initialMode = "rooms",
}) {
    // Keep the initial render stable for Next.js prerendering.
    // Default dates are assigned after the component mounts.
    const [checkIn, setCheckIn] = useState(initialCheckIn || "");
    const [checkOut, setCheckOut] = useState(initialCheckOut || "");

    useEffect(() => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        setCheckIn((current) =>
            current || initialCheckIn || getLocalDateString(today)
        );

        setCheckOut((current) =>
            current || initialCheckOut || getLocalDateString(tomorrow)
        );
    }, [initialCheckIn, initialCheckOut]);

    const [mode, setMode] = useState(initialMode);
    const [activePopup, setActivePopup] = useState(null);
    const [error, setError] = useState("");

    const containerRef = useRef(null);

    useEffect(() => {
        function handleOutsideClick(event) {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target)
            ) {
                setActivePopup(null);
            }
        }

        function handleEscape(event) {
            if (event.key === "Escape") {
                setActivePopup(null);
            }
        }

        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("keydown", handleEscape);
        };
    }, []);

    function handleDatesChange(newCheckIn, newCheckOut) {
  setCheckIn(newCheckIn);
  setCheckOut(newCheckOut);
  setError("");

  if (
    newCheckIn &&
    newCheckOut &&
    newCheckOut > newCheckIn
  ) {
    onSearch?.({
      checkIn: newCheckIn,
      checkOut: newCheckOut,
      mode,
    });
  }
}

    function handleModeChange(newMode) {
        setMode(newMode);
        setError("");
        onModeChange?.(newMode);
    }

    function handleSearch() {
        if (!checkIn || !checkOut) {
            setError("Please select your check-in and check-out dates.");
            return;
        }

        if (checkOut <= checkIn) {
            setError("Check-out must be after check-in.");
            return;
        }

        const start = new Date(`${checkIn}T00:00:00`);
        const end = new Date(`${checkOut}T00:00:00`);

        const nights = Math.round(
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() + 60);

        if (nights > 10) {
            setError("You can book a maximum of 10 nights.");
            return;
        }

        if (start < today || end > maxDate) {
            setError("Bookings are available only within the next 60 days.");
            return;
        }

        setError("");
        setActivePopup(null);

        onSearch?.({
            checkIn,
            checkOut,
            mode,
        });
    }

    return (
        <div
            className="sticky top-0 z-40 w-full"
            ref={containerRef}
        >
            <div
                className="relative z-30 mx-auto grid w-full max-w-3xl grid-cols-1 gap-2 rounded-2xl border p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3"
                style={{
                    backgroundColor: COLORS.background,
                    borderColor: `${COLORS.foreground}20`,
                }}
            >
                {/* DATE SELECTION */}
                <div className="relative min-w-0">
                    <button
                        type="button"
                        onClick={() =>
                            setActivePopup(
                                activePopup === "dates" ? null : "dates"
                            )
                        }
                        aria-expanded={activePopup === "dates"}
                        aria-label={`Select dates. Check-in: ${formatDisplayDate(
                            checkIn
                        )}. Check-out: ${formatDisplayDate(checkOut)}`}
                        className="grid min-h-16 w-full grid-cols-[20%_40%_40%] items-center rounded-xl py-2 text-left transition hover:bg-black/5"
                    >
                        <span
                            className="flex h-full items-center justify-center"
                            aria-hidden="true"
                            style={{ color: COLORS.foreground }}
                        >
                            <svg
                                width="23"
                                height="23"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <rect
                                    x="3"
                                    y="5"
                                    width="18"
                                    height="16"
                                    rx="2"
                                />
                                <path d="M16 3v4M8 3v4M3 10h18" />
                            </svg>
                        </span>

                        <span className="min-w-0 pl-2">
                            <span
                                className="block text-[10px] font-medium tracking-wide opacity-60 sm:text-xs"
                                style={{ color: COLORS.foreground }}
                            >
                                CHECK-IN
                            </span>

                            <span
                                className="mt-1 block truncate text-xs font-semibold sm:text-sm"
                                style={{ color: COLORS.foreground }}
                            >
                                {formatDisplayDate(checkIn)}
                            </span>
                        </span>

                        <span className="min-w-0 pl-2">
                            <span
                                className="block text-[10px] font-medium tracking-wide opacity-60 sm:text-xs"
                                style={{ color: COLORS.foreground }}
                            >
                                CHECK-OUT
                            </span>

                            <span
                                className="mt-1 block truncate text-xs font-semibold sm:text-sm"
                                style={{ color: COLORS.foreground }}
                            >
                                {formatDisplayDate(checkOut)}
                            </span>
                        </span>
                    </button>
                </div>

                {/* ROOMS / PACKAGES TOGGLE */}
                <div
                    className="flex min-w-0 items-center justify-center rounded-xl p-1"
                    style={{
                        backgroundColor: `${COLORS.foreground}08`,
                        border: `1px solid ${COLORS.foreground}15`,
                    }}
                    role="group"
                    aria-label="Choose booking type"
                >
                    <button
                        type="button"
                        onClick={() => handleModeChange("rooms")}
                        aria-pressed={mode === "rooms"}
                        className="min-h-11 flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none"
                        style={{
                            backgroundColor:
                                mode === "rooms"
                                    ? COLORS.accent
                                    : "transparent",
                            color: COLORS.foreground,
                            boxShadow:
                                mode === "rooms"
                                    ? "0 1px 3px rgba(5, 42, 80, 0.12)"
                                    : "none",
                        }}
                    >
                        Rooms
                    </button>

                    <button
                        type="button"
                        onClick={() => handleModeChange("packages")}
                        aria-pressed={mode === "packages"}
                        className="min-h-11 flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none"
                        style={{
                            backgroundColor:
                                mode === "packages"
                                    ? COLORS.accent
                                    : "transparent",
                            color: COLORS.foreground,
                            boxShadow:
                                mode === "packages"
                                    ? "0 1px 3px rgba(5, 42, 80, 0.12)"
                                    : "none",
                        }}
                    >
                        Packages
                    </button>
                </div>

                {/* CALENDAR POPUP */}
                {activePopup === "dates" && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-2 w-full min-w-0 max-w-full">
                        <Calendar
                            checkIn={checkIn}
                            checkOut={checkOut}
                            onChange={handleDatesChange}
                            onClose={() => setActivePopup(null)}
                        />
                    </div>
                )}
            </div>

            {error && (
                <p
                    role="alert"
                    className="mt-2 text-sm font-medium"
                    style={{ color: "#b42318" }}
                >
                    {error}
                </p>
            )}
        </div>
    );
}
