
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import rooms from "@/data/rooms.json";
import RoomsModal from "./RoomsModal";
import {
  PRICING,
  calculateRoomPrice,
  formatPrice,
} from "@/logic/price";
import { updateBookingRooms } from "@/logic/Data";

export default function RoomsCard({
  onSelectRoom,
  onOccupancyChange,
  selectedRoomIds = [],
  nights = 1,
  availableRoomIds = null,
}) {
  const [occupancy, setOccupancy] = useState({});
  const [activeRoom, setActiveRoom] = useState(null);

  // Keep every room visible. An empty array means all rooms are sold out.
  const isRoomAvailable = (roomId) =>
    availableRoomIds === null || availableRoomIds.includes(roomId);

  // Keep the shared booking record synchronized with selected rooms.
  useEffect(() => {
    const selectedRooms = selectedRoomIds
      .map((id) => {
        const room = rooms.find((item) => item.id === id);

        if (!room) return null;

        const guests = occupancy[id] || {
          adults: 0,
          children: 0,
        };

        const stayNights = Math.max(1, Number(nights) || 1);
        const basePrice = Number(
          room.price ?? room.basePrice ?? PRICING.accommodation.weekday
        );

        const totalPrice = calculateRoomPrice({
          basePrice,
          extraAdults: guests.adults,
          chargeableChildren: guests.children,
          nights: stayNights,
        });

        return {
          ...room,
          ...guests,
          extraAdults: guests.adults,
          extraChildren: guests.children,
          basePrice,
          nights: stayNights,
          totalPrice,
        };
      })
      .filter(Boolean);

    updateBookingRooms(selectedRooms);
  }, [selectedRoomIds, occupancy, nights]);

  const updateOccupancy = (roomId, type, change) => {
    // Do not allow occupancy changes for sold-out rooms.
    if (!isRoomAvailable(roomId)) return;

    const current = occupancy[roomId] || {
      adults: 0,
      children: 0,
    };

    const room = rooms.find((item) => item.id === roomId);
    if (!room) return;

    const maxGuests = room.maxGuests ?? Infinity;
    const nextValue = Math.max(0, current[type] + change);

    const otherOccupants =
      2 + (type === "adults" ? current.children : current.adults);

    if (nextValue + otherOccupants > maxGuests) {
      return;
    }

    const updatedGuests = {
      ...current,
      [type]: nextValue,
    };

    setOccupancy((previous) => ({
      ...previous,
      [roomId]: updatedGuests,
    }));

    const stayNights = Math.max(1, Number(nights) || 1);

    const basePrice = Number(
      room.price ?? room.basePrice ?? PRICING.accommodation.weekday
    );

    const totalPrice = calculateRoomPrice({
      basePrice,
      extraAdults: updatedGuests.adults,
      chargeableChildren: updatedGuests.children,
      nights: stayNights,
    });

    if (selectedRoomIds.includes(roomId)) {
      onOccupancyChange?.({
        ...room,
        ...updatedGuests,
        extraAdults: updatedGuests.adults,
        extraChildren: updatedGuests.children,
        basePrice,
        nights: stayNights,
        totalPrice,
      });
    }
  };

  return (
    <section className="w-full">
      <div className="flex flex-col gap-6">
        {rooms.map((room) => {
          const isAvailable = isRoomAvailable(room.id);
          const isSelected = selectedRoomIds.includes(room.id);

          const guests = occupancy[room.id] || {
            adults: 0,
            children: 0,
          };

          const stayNights = Math.max(1, Number(nights) || 1);

          const basePrice = Number(
            room.price ?? room.basePrice ?? PRICING.accommodation.weekday
          );

          const totalPrice = calculateRoomPrice({
            basePrice,
            extraAdults: guests.adults,
            chargeableChildren: guests.children,
            nights: stayNights,
          });

          return (
            <article
              key={room.id}
              aria-disabled={!isAvailable}
              className={`grid w-full grid-cols-1 overflow-hidden rounded-2xl border shadow-sm transition-colors lg:grid-cols-2 ${
                !isAvailable
                  ? "border-gray-300 bg-gray-100 opacity-75"
                  : isSelected
                    ? "border-[#e4b441] bg-white ring-2 ring-[#e4b441]/40"
                    : "border-[#052a50]/10 bg-white"
              }`}
            >
              {/* LEFT COLUMN: ROOM INFORMATION */}
              <div className="min-w-0 p-4 sm:p-6">
                <div
                  className={`relative aspect-[2/1] w-full overflow-hidden rounded-xl bg-[#F7FAEE] ${
                    !isAvailable ? "grayscale" : ""
                  }`}
                >
                  <Image
                    src={room.image}
                    alt={room.name}
                    fill
                    sizes="(max-width: 1023px) 100vw, 35vw"
                    className="object-cover"
                  />

                  <span className="absolute left-3 top-3 rounded-full bg-[#F7FAEE]/95 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#052a50]">
                    {room.shortName}
                  </span>

                  {!isAvailable && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/35">
                      <span className="rounded-full border border-white/70 bg-gray-900/80 px-5 py-2.5 text-sm font-bold tracking-[0.2em] text-white">
                        SOLD OUT
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div
                    className={`flex items-center gap-2 text-sm font-medium ${
                      isAvailable ? "text-[#052a50]" : "text-gray-500"
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="7" r="4" />
                      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
                    </svg>

                    Up to {room.maxGuests} guests
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (isAvailable) setActiveRoom(room);
                    }}
                    disabled={!isAvailable}
                    className="text-sm font-semibold text-[#052a50] underline decoration-[#e4b441] underline-offset-4 hover:text-[#b08a28] disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
                  >
                    More Details +
                  </button>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b08a28]">
                    Room {room.number}
                  </p>

                  <h2
                    className={`mt-1 text-xl font-semibold sm:text-2xl ${
                      isAvailable ? "text-[#052a50]" : "text-gray-500"
                    }`}
                  >
                    {room.name}
                  </h2>

                  {room.tagline && (
                    <p
                      className={`mt-1 font-display text-base ${
                        isAvailable ? "text-[#052a50]/75" : "text-gray-500"
                      }`}
                    >
                      {room.tagline}
                    </p>
                  )}
                </div>

                <div className="mt-5">
                  <div className="flex flex-wrap gap-2">
                    {(room.highlights || []).map((highlight) => (
                      <span
                        key={highlight}
                        className={`rounded-full border px-3 py-1.5 text-xs ${
                          isAvailable
                            ? "border-[#052a50]/10 bg-[#F7FAEE] text-[#052a50]/80"
                            : "border-gray-300 bg-gray-200 text-gray-500"
                        }`}
                      >
                        {highlight}
                      </span>
                    ))}

                    {(!room.highlights ||
                      room.highlights.length === 0) && (
                      <span className="text-sm text-gray-500">
                        Room highlights coming soon.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: OCCUPANCY AND PRICE */}
              <div
                className={`flex min-w-0 flex-col border-t p-4 sm:p-6 lg:border-l lg:border-t-0 ${
                  isAvailable
                    ? "border-[#052a50]/10 bg-[#F7FAEE]/60"
                    : "border-gray-300 bg-gray-200/70"
                }`}
              >
                <div
                  className={`rounded-xl border p-4 ${
                    isAvailable
                      ? "border-[#052a50]/10 bg-white"
                      : "border-gray-300 bg-gray-100"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
                    Your Stay
                  </p>

                  <div
                    className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-semibold ${
                      isAvailable ? "text-[#052a50]" : "text-gray-500"
                    }`}
                  >
                    <span>
                      {stayNights} {stayNights === 1 ? "Night" : "Nights"}
                    </span>

                    <span className="opacity-30">|</span>
                    <span>2 Adults</span>
                    <span className="opacity-30">|</span>
                    <span>Breakfast Included</span>
                  </div>

                  <p className="mt-2 text-xs text-gray-500">
                    Base occupancy and complimentary breakfast are included
                    in the room price.
                  </p>
                </div>

                <div className="mt-5">
                  <h3
                    className={`text-sm font-semibold ${
                      isAvailable ? "text-[#052a50]" : "text-gray-500"
                    }`}
                  >
                    Extra Occupancy
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Add extra guests to your stay.
                  </p>

                  {/* Extra Adults */}
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          isAvailable ? "text-[#052a50]" : "text-gray-500"
                        }`}
                      >
                        Extra Adults
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {formatPrice(PRICING.extraGuests.adult)} / night
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateOccupancy(room.id, "adults", -1)
                        }
                        disabled={!isAvailable || guests.adults === 0}
                        aria-label={`Remove extra adult from ${room.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#052a50]/20 bg-white text-lg text-[#052a50] hover:bg-[#e4b441] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        −
                      </button>

                      <span className="w-4 text-center text-sm font-semibold tabular-nums text-gray-500">
                        {guests.adults}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          updateOccupancy(room.id, "adults", 1)
                        }
                        disabled={
                          !isAvailable ||
                          2 + guests.adults + guests.children >=
                            (room.maxGuests ?? Infinity)
                        }
                        aria-label={`Add extra adult to ${room.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#052a50]/20 bg-white text-lg text-[#052a50] hover:bg-[#e4b441] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Children */}
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          isAvailable ? "text-[#052a50]" : "text-gray-500"
                        }`}
                      >
                        Children (6–12 years)
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {formatPrice(PRICING.extraGuests.child)} / night
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateOccupancy(room.id, "children", -1)
                        }
                        disabled={!isAvailable || guests.children === 0}
                        aria-label={`Remove child from ${room.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#052a50]/20 bg-white text-lg text-[#052a50] hover:bg-[#e4b441] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        −
                      </button>

                      <span className="w-4 text-center text-sm font-semibold tabular-nums text-gray-500">
                        {guests.children}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          updateOccupancy(room.id, "children", 1)
                        }
                        disabled={
                          !isAvailable ||
                          2 + guests.adults + guests.children >=
                            (room.maxGuests ?? Infinity)
                        }
                        aria-label={`Add child to ${room.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#052a50]/20 bg-white text-lg text-[#052a50] hover:bg-[#e4b441] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <p className="mt-4 text-xs leading-5 text-gray-500">
                    Children under 6 stay complimentary. Room occupancy
                    limits apply.
                  </p>
                </div>

                {/* Total Price and Selection */}
                <div className="mt-auto pt-6">
                  <div
                    className={`rounded-xl border p-4 ${
                      isAvailable
                        ? "border-[#052a50]/10 bg-white"
                        : "border-gray-300 bg-gray-100"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
                      Total Stay Price
                    </p>

                    <p
                      className={`mt-2 text-2xl font-semibold tracking-tight sm:text-3xl ${
                        isAvailable ? "text-[#052a50]" : "text-gray-500"
                      }`}
                    >
                      {formatPrice(totalPrice)}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      {formatPrice(basePrice)} base rate + extra guests,
                      multiplied by {stayNights}{" "}
                      {stayNights === 1 ? "night" : "nights"}. Taxes are not
                      included.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => {
                      if (!isAvailable) return;

                      onSelectRoom?.({
                        ...room,
                        ...guests,
                        extraAdults: guests.adults,
                        extraChildren: guests.children,
                        nights: stayNights,
                        basePrice,
                        totalPrice,
                      });
                    }}
                    aria-pressed={isSelected}
                    className={`mt-4 w-full rounded-xl px-5 py-3.5 text-sm font-semibold transition-colors ${
                      !isAvailable
                        ? "cursor-not-allowed bg-gray-300 text-gray-600"
                        : isSelected
                          ? "bg-[#e4b441] text-[#052a50]"
                          : "bg-[#052a50] text-white hover:bg-[#e4b441] hover:text-[#052a50]"
                    }`}
                  >
                    {!isAvailable
                      ? "SOLD OUT"
                      : isSelected
                        ? "Selected"
                        : "Select Room"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {activeRoom && (
        <RoomsModal
          room={activeRoom}
          onClose={() => setActiveRoom(null)}
        />
      )}
    </section>
  );
}
