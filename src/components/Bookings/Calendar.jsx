
"use client";

import { useEffect, useState } from "react";

const COLORS = {
    background: "#F7FAEE",
    foreground: "#052a50",
    accent: "#e4b441",
};

const MAX_BOOKING_DAYS = 60;
const MAX_NIGHTS = 10;

function startOfDay(date) {
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function parseDate(dateString) {
    if (!dateString) return null;

    const [year, month, day] = dateString.split("-").map(Number);

    return new Date(year, month - 1, day);
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function addMonths(date, months) {
    return new Date(
        date.getFullYear(),
        date.getMonth() + months,
        1
    );
}

function getMonthName(date) {
    return date.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
    });
}

function getCalendarDays(monthDate) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const offset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];

    for (let i = 0; i < offset; i++) {
        cells.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        cells.push(new Date(year, month, day));
    }

    while (cells.length % 7 !== 0) {
        cells.push(null);
    }

    return cells;
}

function isSameDate(first, second) {
    return Boolean(
        first &&
        second &&
        first.getFullYear() === second.getFullYear() &&
        first.getMonth() === second.getMonth() &&
        first.getDate() === second.getDate()
    );
}

export default function Calendar({
    checkIn,
    checkOut,
    onChange,
    onClose,
}) {
    const [today, setToday] = useState(null);
    const [visibleMonth, setVisibleMonth] = useState(null);
    const [selectionError, setSelectionError] = useState("");

    // Avoid reading the current time during server prerendering.
    useEffect(() => {
        const currentDate = startOfDay(new Date());

        setToday(currentDate);
        setVisibleMonth(
            new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        );
    }, []);

    const maxDate = today ? addDays(today, MAX_BOOKING_DAYS) : null;

    const firstVisibleMonth = visibleMonth
        ? new Date(
              visibleMonth.getFullYear(),
              visibleMonth.getMonth(),
              1
          )
        : null;

    const secondVisibleMonth = firstVisibleMonth
        ? addMonths(firstVisibleMonth, 1)
        : null;

    const currentMonth = today
        ? new Date(today.getFullYear(), today.getMonth(), 1)
        : null;

    const lastBookableMonth = maxDate
        ? new Date(maxDate.getFullYear(), maxDate.getMonth(), 1)
        : null;

    const canGoPrevious = Boolean(
        firstVisibleMonth &&
        currentMonth &&
        firstVisibleMonth.getTime() > currentMonth.getTime()
    );

    // Allow mobile users to navigate through the entire booking window.
    const canGoNext = Boolean(
        firstVisibleMonth &&
        lastBookableMonth &&
        firstVisibleMonth.getTime() < lastBookableMonth.getTime()
    );

    function handleDateClick(date) {
        if (!date || !today || !maxDate) return;

        const selectedDate = startOfDay(date);

        if (selectedDate < today || selectedDate > maxDate) {
            return;
        }

        const selectedDateString = formatDate(selectedDate);

        const parsedCheckIn = parseDate(checkIn);
        const parsedCheckOut = parseDate(checkOut);

        // Choose a new check-in date.
        if (
            !parsedCheckIn ||
            parsedCheckOut ||
            selectedDate <= parsedCheckIn
        ) {
            setSelectionError("");
            onChange?.(selectedDateString, "");
            return;
        }

        const nights = Math.round(
            (selectedDate.getTime() -
                startOfDay(parsedCheckIn).getTime()) /
            (1000 * 60 * 60 * 24)
        );

        if (nights < 1) {
            setSelectionError("Check-out must be after check-in.");
            return;
        }

        if (nights > MAX_NIGHTS) {
            setSelectionError("You can book a maximum of 10 nights.");
            return;
        }

        if (selectedDate > maxDate) {
            setSelectionError(
                "Bookings are available only within the next 60 days."
            );
            return;
        }

        setSelectionError("");
        onChange?.(checkIn, selectedDateString);
        onClose?.();
    }

    function renderMonth(monthDate) {
        const calendarDays = getCalendarDays(monthDate);

        const parsedCheckIn = parseDate(checkIn);
        const parsedCheckOut = parseDate(checkOut);

        return (
            <div className="w-full min-w-0 flex-1">
                {/* Month heading */}
                <div className="mb-4 flex items-center justify-center">
                    <h3
                        className="text-sm font-semibold sm:text-base"
                        style={{ color: COLORS.foreground }}
                    >
                        {getMonthName(monthDate)}
                    </h3>
                </div>

                {/* Weekdays */}
                <div className="mb-2 grid grid-cols-7">
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(
                        (day) => (
                            <div
                                key={day}
                                className="py-2 text-center text-xs font-medium"
                                style={{
                                    color: `${COLORS.foreground}80`,
                                }}
                            >
                                {day}
                            </div>
                        )
                    )}
                </div>

                {/* Calendar dates */}
                <div className="grid grid-cols-7 gap-y-1">
                    {calendarDays.map((date, index) => {
                        if (!date) {
                            return (
                                <div
                                    key={`empty-${index}`}
                                    className="aspect-square"
                                />
                            );
                        }

                        const dateValue = startOfDay(date);
                        const dateString = formatDate(dateValue);

                        const isPast = dateValue < today;
                        const isBeyondWindow = dateValue > maxDate;

                        const isCheckIn = isSameDate(
                            dateValue,
                            parsedCheckIn
                        );

                        const isCheckOut = isSameDate(
                            dateValue,
                            parsedCheckOut
                        );

                        const isWithinRange =
                            parsedCheckIn &&
                            parsedCheckOut &&
                            dateValue > parsedCheckIn &&
                            dateValue < parsedCheckOut;

                        const nightsFromCheckIn = parsedCheckIn
                            ? Math.round(
                                (dateValue.getTime() -
                                    startOfDay(parsedCheckIn).getTime()) /
                                (1000 * 60 * 60 * 24)
                            )
                            : 0;

                        const exceedsStayLimit =
                            parsedCheckIn &&
                            !parsedCheckOut &&
                            dateValue > parsedCheckIn &&
                            nightsFromCheckIn > MAX_NIGHTS;

                        const isDisabled =
                            isPast ||
                            isBeyondWindow ||
                            exceedsStayLimit;

                        const isSelected = isCheckIn || isCheckOut;

                        return (
                            <button
                                key={dateString}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => handleDateClick(dateValue)}
                                aria-label={dateValue.toLocaleDateString(
                                    "en-IN",
                                    {
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric",
                                    }
                                )}
                                aria-pressed={isSelected}
                                className={[
                                    "relative flex aspect-square items-center justify-center rounded-full text-xs transition sm:text-sm",
                                    isDisabled
                                        ? "cursor-not-allowed opacity-25"
                                        : "cursor-pointer hover:bg-[#e4b441]/30",
                                    isSelected
                                        ? "font-bold"
                                        : "font-medium",
                                ].join(" ")}
                                style={{
                                    backgroundColor: isSelected
                                        ? COLORS.accent
                                        : isWithinRange
                                            ? `${COLORS.accent}35`
                                            : "transparent",
                                    color: COLORS.foreground,
                                    border: isSameDate(dateValue, today)
                                        ? `1px solid ${COLORS.foreground}60`
                                        : "1px solid transparent",
                                }}
                            >
                                {dateValue.getDate()}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div
            className="box-border w-full min-w-0 max-w-full overflow-x-hidden rounded-2xl border p-3 shadow-xl sm:p-5"
            style={{
                backgroundColor: COLORS.background,
                borderColor: `${COLORS.foreground}20`,
                color: COLORS.foreground,
            }}
        >


            {/* Month navigation */}
            <div className="mb-3 flex items-center justify-between">
                <button
                    type="button"
                    disabled={!canGoPrevious}
                    onClick={() =>
                        setVisibleMonth((month) => addMonths(month, -1))
                    }
                    aria-label="Previous month"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-25"
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                </button>

                <span
                    className="text-center text-xs"
                    style={{ color: `${COLORS.foreground}70` }}
                >
                    {MAX_BOOKING_DAYS}-day availability
                </span>

                <button
                    type="button"
                    disabled={!canGoNext}
                    onClick={() =>
                        setVisibleMonth((month) => addMonths(month, 1))
                    }
                    aria-label="Next month"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-25"
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="m9 18 6-6-6-6" />
                    </svg>
                </button>
            </div>

            {/* One month on mobile; two months on larger screens */}
            {today && maxDate && firstVisibleMonth && secondVisibleMonth ? (
                <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-5">
                    {renderMonth(firstVisibleMonth)}

                    <div className="hidden min-w-0 sm:block">
                        {renderMonth(secondVisibleMonth)}
                    </div>
                </div>
            ) : (
                <div className="flex min-h-48 items-center justify-center text-sm">
                    Loading calendar...
                </div>
            )}

            {/* Selected dates summary */}
            <div
                className="mt-5 rounded-xl border p-3"
                style={{ borderColor: `${COLORS.foreground}15` }}
            >
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <p
                            className="text-[10px] font-medium tracking-wider"
                            style={{ color: `${COLORS.foreground}65` }}
                        >
                            CHECK-IN
                        </p>

                        <p className="mt-1 text-xs font-semibold sm:text-sm">
                            {checkIn
                                ? parseDate(checkIn).toLocaleDateString(
                                    "en-IN",
                                    {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                    }
                                )
                                : "Select date"}
                        </p>
                    </div>

                    <div>
                        <p
                            className="text-[10px] font-medium tracking-wider"
                            style={{ color: `${COLORS.foreground}65` }}
                        >
                            CHECK-OUT
                        </p>

                        <p className="mt-1 text-xs font-semibold sm:text-sm">
                            {checkOut
                                ? parseDate(checkOut).toLocaleDateString(
                                    "en-IN",
                                    {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                    }
                                )
                                : "Select date"}
                        </p>
                    </div>
                </div>

                {checkIn && checkOut && (
                    <p
                        className="mt-2 text-xs font-medium"
                        style={{ color: COLORS.foreground }}
                    >
                        {Math.round(
                            (parseDate(checkOut).getTime() -
                                parseDate(checkIn).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )}{" "}
                        night(s)
                    </p>
                )}
            </div>

            {selectionError && (
                <p
                    role="alert"
                    className="mt-3 text-xs font-medium"
                    style={{ color: "#b42318" }}
                >
                    {selectionError}
                </p>
            )}

            <p
                className="mt-3 text-[11px] leading-5"
                style={{ color: `${COLORS.foreground}75` }}
            >
                Choose your check-in date first, then your checkout date.
                Checkout must be within 10 nights and the 60-day booking
                window.
            </p>
        </div>
    );
}
