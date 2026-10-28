
"use client";

import Image from "next/image";

const COLORS = {
  background: "#F7FAEE",
  foreground: "#052a50",
  accent: "#e4b441",
};

function formatPrice(price) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(price) || 0);
}

export default function PackagesCard({
  packages = [],
  onSelectPackage,
  selectedPackageIds = [],
  nights = 1,
}) {
  const stayNights = Math.max(1, Number(nights) || 1);

  if (!packages.length) {
    return null;
  }

  return (
    <section className="w-full">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {packages.map((item) => {
          const isSelected = selectedPackageIds.includes(item.id);
          const highlights = Array.isArray(item.highlights)
            ? item.highlights
            : [];

          const basePrice = Number(item.price ?? item.basePrice ?? 0);
          const totalPrice = basePrice * stayNights;

          return (
            <article
              key={item.id}
              className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                isSelected
                  ? "border-[#e4b441] ring-2 ring-[#e4b441]/40"
                  : "border-[#052a50]/10"
              }`}
            >
              {/* Package image */}
              <div className="relative aspect-[2/1] w-full overflow-hidden bg-[#F7FAEE]">
                {item.image ? (
                  <Image
                    src={item.image}
                    alt={item.name || item.shortName || "SU VILLA package"}
                    fill
                    sizes="(max-width: 1023px) 100vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[#052a50]/50">
                    Package image coming soon
                  </div>
                )}

                <span className="absolute left-4 top-4 rounded-full bg-[#F7FAEE]/95 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#052a50]">
                  {item.shortName || item.name}
                </span>

                {isSelected && (
                  <span className="absolute right-4 top-4 rounded-full bg-[#e4b441] px-3 py-1.5 text-xs font-semibold text-[#052a50]">
                    Selected
                  </span>
                )}
              </div>

              {/* Package information */}
              <div className="flex flex-1 flex-col p-4 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b08a28]">
                  Package {item.number || ""}
                </p>

                <h2 className="mt-1 text-xl font-semibold text-[#052a50] sm:text-2xl">
                  {item.name || item.shortName}
                </h2>

                {item.tagline && (
                  <p className="mt-2 font-display text-base text-[#052a50]/75">
                    {item.tagline}
                  </p>
                )}

                {item.description && (
                  <p className="mt-3 text-sm leading-6 text-[#052a50]/70">
                    {item.description}
                  </p>
                )}

                {/* Package highlights */}
                <div className="mt-5">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#052a50]/70">
                    Package Highlights
                  </h3>

                  <div className="flex flex-wrap gap-2">
                    {highlights.length > 0 ? (
                      highlights.map((highlight) => (
                        <span
                          key={highlight}
                          className="rounded-full border border-[#052a50]/10 bg-[#F7FAEE] px-3 py-1.5 text-xs text-[#052a50]/80"
                        >
                          {highlight}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[#052a50]/50">
                        Package highlights coming soon.
                      </span>
                    )}
                  </div>
                </div>

                {/* Stay summary */}
                <div className="mt-6 rounded-xl border border-[#052a50]/10 bg-[#F7FAEE]/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#052a50]/55">
                    Your Stay
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-semibold text-[#052a50]">
                    <span>
                      {stayNights} {stayNights === 1 ? "Night" : "Nights"}
                    </span>

                    <span className="text-[#052a50]/30">|</span>

                    <span>
                      {item.id === "FullVilla" ? "4 Rooms" : "3 Rooms"}
                    </span>

                    <span className="text-[#052a50]/30">|</span>

                    <span>Breakfast Included</span>
                  </div>
                </div>

                {/* Price and selection */}
                <div className="mt-auto pt-6">
                  <div className="rounded-xl border border-[#052a50]/10 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#052a50]/55">
                      Total Stay Price
                    </p>

                    {basePrice > 0 ? (
                      <>
                        <p className="mt-2 text-2xl font-semibold tracking-tight text-[#052a50] sm:text-3xl">
                          {formatPrice(totalPrice)}
                        </p>

                        <p className="mt-1 text-xs leading-5 text-[#052a50]/55">
                          {formatPrice(basePrice)} per night × {stayNights}{" "}
                          {stayNights === 1 ? "night" : "nights"}. Taxes are
                          calculated at checkout.
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-[#052a50]/65">
                        Package pricing will be confirmed during booking.
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onSelectPackage?.({
                        ...item,
                        nights: stayNights,
                        totalPrice: basePrice > 0 ? totalPrice : null,
                      })
                    }
                    aria-pressed={isSelected}
                    className={`mt-4 w-full rounded-xl px-5 py-3.5 text-sm font-semibold transition ${
                      isSelected
                        ? "bg-[#e4b441] text-[#052a50]"
                        : "bg-[#052a50] text-white hover:bg-[#e4b441] hover:text-[#052a50]"
                    }`}
                  >
                    {isSelected ? "Selected" : "Select Package"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
