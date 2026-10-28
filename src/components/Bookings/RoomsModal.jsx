
"use client";

import { useEffect } from "react";
import Image from "next/image";

export default function RoomsModal({ room, onClose }) {
  useEffect(() => {
    if (!room) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [room, onClose]);

  if (!room) return null;

  const amenityGroups = [
    { title: "Room Features", items: room.features || [] },
    { title: "Bathroom", items: room.bathroom || [] },
    { title: "Technology & Comfort", items: room.tech || [] },
    { title: "Additional Amenities", items: room.amenities || [] },
  ].filter((group) => group.items.length > 0);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#052a50]/60 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-modal-title"
        className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#052a50]/10 px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b08a28]">
              Room {room.number}
            </p>

            <h2
              id="room-modal-title"
              className="mt-1 text-xl font-semibold text-[#052a50] sm:text-2xl"
            >
              {room.name}
            </h2>

            {room.tagline && (
              <p className="mt-1 text-sm text-[#052a50]/65">
                {room.tagline}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close room details"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F7FAEE] text-2xl text-[#052a50] hover:bg-[#e4b441]"
          >
            &times;
          </button>
        </div>

        {/* Scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
          {/* Image */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#F7FAEE] sm:aspect-[16/7]">
            <Image
              src={room.heroImage || room.image}
              alt={room.name}
              fill
              sizes="(max-width: 768px) 100vw, 800px"
              className="object-cover"
            />
          </div>

          {/* Description */}
          <section className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.15em] text-[#052a50]">
              About this room
            </h3>

            <p className="mt-3 text-sm leading-7 text-[#052a50]/70">
              {room.description}
            </p>
          </section>

          {/* All room details */}
          <section className="mt-7">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-[#052a50]">
              Room Details
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(room.details || []).map((detail) => (
                <div
                  key={detail.label}
                  className="rounded-xl border border-[#052a50]/10 bg-[#F7FAEE]/70 p-4"
                >
                  <p className="text-xs text-[#052a50]/55">
                    {detail.label}
                  </p>

                  <p className="mt-1 text-sm font-medium text-[#052a50]">
                    {detail.value}
                  </p>
                </div>
              ))}

              <div className="rounded-xl border border-[#052a50]/10 bg-[#F7FAEE]/70 p-4">
                <p className="text-xs text-[#052a50]/55">
                  Maximum Occupancy
                </p>

                <p className="mt-1 text-sm font-medium text-[#052a50]">
                  Up to {room.maxGuests} guests
                </p>
              </div>
            </div>
          </section>

          {/* Complete amenities, excluding highlights */}
          <section className="mt-7">
            <h3 className="mb-5 text-sm font-semibold uppercase tracking-[0.15em] text-[#052a50]">
              Amenities & Facilities
            </h3>

            {amenityGroups.length > 0 ? (
              <div className="flex flex-col gap-6">
                {amenityGroups.map((group) => (
                  <div key={group.title}>
                    <h4 className="mb-3 text-sm font-semibold text-[#052a50]/80">
                      {group.title}
                    </h4>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {group.items.map((item) => (
                        <div
                          key={item}
                          className="flex items-start gap-3 rounded-lg border border-[#052a50]/10 bg-white p-3"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e4b441]/20 text-xs font-bold text-[#8a6a16]"
                          >
                            ✓
                          </span>

                          <span className="text-sm leading-6 text-[#052a50]/80">
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#052a50]/55">
                Additional amenities will be updated soon.
              </p>
            )}
          </section>

          {/* Room gallery */}
          {room.images?.length > 0 && (
            <section className="mt-7">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-[#052a50]">
                Room Gallery
              </h3>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {room.images.map((image, index) => (
                  <div
                    key={image}
                    className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#F7FAEE]"
                  >
                    <Image
                      src={image}
                      alt={`${room.name} - view ${index + 1}`}
                      fill
                      sizes="(max-width: 640px) 50vw, 260px"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[#052a50]/10 bg-white px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-[#052a50] px-5 py-3 text-sm font-semibold text-white hover:bg-[#e4b441] hover:text-[#052a50]"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
