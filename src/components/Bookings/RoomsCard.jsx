
"use client";

import { useState } from "react";
import Image from "next/image";
import rooms from "@/data/rooms.json";
import RoomsModal from "./RoomsModal";
import {
  PRICING,
  calculateRoomPrice,
  formatPrice,
} from "@/logic/price";

export default function RoomsCard({
  onSelectRoom,
  onOccupancyChange,
  selectedRoomIds = [],
  nights = 1,
  availableRoomIds = null,
}) {
  const [occupancy, setOccupancy] = useState({});
  const [activeRoom, setActiveRoom] = useState(null);

  // Show all rooms before the first availability check.
  // After the check, show only rooms available for the selected dates.
  const visibleRooms =
    availableRoomIds === null
      ? rooms
      : rooms.filter((room) => availableRoomIds.includes(room.id));

  // Update occupancy and immediately synchronize the selected room with Cart.
  const updateOccupancy = (roomId, type, change) => {
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

    // Update Cart only if this room is already selected.
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
        {visibleRooms.map((room) => {
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
              className={`grid w-full grid-cols-1 overflow-hidden rounded-2xl border bg-white shadow-sm lg:grid-cols-2 ${
                isSelected
                  ? "border-[#e4b441] ring-2 ring-[#e4b441]/40"
                  : "border-[#052a50]/10"
              }`}
            >
              {/* LEFT COLUMN: ROOM INFORMATION */}
              <div className="min-w-0 p-4 sm:p-6">
                <div className="relative aspect-[2/1] w-full overflow-hidden rounded-xl bg-[#F7FAEE]">
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
                </div>

                {/* Occupancy and More Details */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-[#052a50]">
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
                    onClick={() => setActiveRoom(room)}
                    className="text-sm font-semibold text-[#052a50] underline decoration-[#e4b441] underline-offset-4 hover:text-[#b08a28]"
                  >
                    More Details +
                  </button>
                </div>

                {/* Room description */}
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b08a28]">
                    Room {room.number}
                  </p>

                  <h2 className="mt-1 text-xl font-semibold text-[#052a50] sm:text-2xl">
                    {room.name}
                  </h2>

                  {room.tagline && (
                    <p className="mt-1 font-display text-base text-[#052a50]/75">
                      {room.tagline}
                    </p>
                  )}
                </div>

                {/* Highlights from rooms.json */}
                <div className="mt-5">
                  <div className="flex flex-wrap gap-2">
                    {(room.highlights || []).map((highlight) => (
                      <span
                        key={highlight}
                        className="rounded-full border border-[#052a50]/10 bg-[#F7FAEE] px-3 py-1.5 text-xs text-[#052a50]/80"
                      >
                        {highlight}
                      </span>
                    ))}

                    {(!room.highlights ||
                      room.highlights.length === 0) && (
                      <span className="text-sm text-[#052a50]/50">
                        Room highlights coming soon.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: OCCUPANCY AND PRICE */}
              <div className="flex min-w-0 flex-col border-t border-[#052a50]/10 bg-[#F7FAEE]/60 p-4 sm:p-6 lg:border-l lg:border-t-0">
                {/* Combined stay summary */}
                <div className="rounded-xl border border-[#052a50]/10 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#052a50]/55">
                    Your Stay
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-semibold text-[#052a50]">
                    <span>
                      {stayNights}{" "}
                      {stayNights === 1 ? "Night" : "Nights"}
                    </span>

                    <span className="text-[#052a50]/30">|</span>

                    <span>2 Adults</span>

                    <span className="text-[#052a50]/30">|</span>

                    <span>Breakfast Included</span>
                  </div>

                  <p className="mt-2 text-xs text-[#052a50]/55">
                    Base occupancy and complimentary breakfast are
                    included in the room price.
                  </p>
                </div>

                {/* Extra occupancy */}
                <div className="mt-5">
                  <h3 className="text-sm font-semibold text-[#052a50]">
                    Extra Occupancy
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-[#052a50]/60">
                    Add extra guests to your stay.
                  </p>

                  {/* Extra adults */}
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#052a50]">
                        Extra Adults
                      </p>

                      <p className="mt-1 text-xs text-[#052a50]/60">
                        {formatPrice(PRICING.extraGuests.adult)} / night
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateOccupancy(room.id, "adults", -1)
                        }
                        disabled={guests.adults === 0}
                        aria-label={`Remove extra adult from ${room.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#052a50]/20 bg-white text-lg text-[#052a50] hover:bg-[#e4b441] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        −
                      </button>

                      <span className="w-4 text-center text-sm font-semibold tabular-nums text-[#052a50]">
                        {guests.adults}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          updateOccupancy(room.id, "adults", 1)
                        }
                        disabled={
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
                      <p className="text-sm font-medium text-[#052a50]">
                        Children (6–12 years)
                      </p>

                      <p className="mt-1 text-xs text-[#052a50]/60">
                        {formatPrice(PRICING.extraGuests.child)} / night
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          updateOccupancy(room.id, "children", -1)
                        }
                        disabled={guests.children === 0}
                        aria-label={`Remove child from ${room.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#052a50]/20 bg-white text-lg text-[#052a50] hover:bg-[#e4b441] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        −
                      </button>

                      <span className="w-4 text-center text-sm font-semibold tabular-nums text-[#052a50]">
                        {guests.children}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          updateOccupancy(room.id, "children", 1)
                        }
                        disabled={
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

                  <p className="mt-4 text-xs leading-5 text-[#052a50]/55">
                    Children under 6 stay complimentary. Room
                    occupancy limits apply.
                  </p>
                </div>

                {/* Total price */}
                <div className="mt-auto pt-6">
                  <div className="rounded-xl border border-[#052a50]/10 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#052a50]/55">
                      Total Stay Price
                    </p>

                    <p className="mt-2 text-2xl font-semibold tracking-tight text-[#052a50] sm:text-3xl">
                      {formatPrice(totalPrice)}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-[#052a50]/55">
                      {formatPrice(basePrice)} base rate + extra
                      guests, multiplied by {stayNights}{" "}
                      {stayNights === 1 ? "night" : "nights"}.
                      Taxes are not included.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onSelectRoom?.({
                        ...room,
                        extraAdults: guests.adults,
                        extraChildren: guests.children,
                        nights: stayNights,
                        basePrice,
                        totalPrice,
                      })
                    }
                    aria-pressed={isSelected}
                    className={`mt-4 w-full rounded-xl px-5 py-3.5 text-sm font-semibold ${
                      isSelected
                        ? "bg-[#e4b441] text-[#052a50]"
                        : "bg-[#052a50] text-white hover:bg-[#e4b441] hover:text-[#052a50]"
                    }`}
                  >
                    {isSelected ? "Selected" : "Select Room"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Room details modal */}
      {activeRoom && (
        <RoomsModal
          room={activeRoom}
          onClose={() => setActiveRoom(null)}
        />
      )}
    </section>
  );
}
