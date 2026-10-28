
"use client";

import { useEffect } from "react";

export default function Modal({
  isOpen,
  onClose,
  title = "Your Cart",
  children,
}) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-[#052a50]/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-[#F7FAEE] shadow-2xl sm:rounded-3xl"
      >
        {/* Modal header */}
        <header className="flex items-center justify-between border-b border-[#052a50]/10 px-5 py-4 sm:px-6">
          <h2 className="font-display text-2xl font-semibold text-[#052a50]">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#052a50]/10 bg-white text-2xl text-[#052a50] transition hover:bg-[#e4b441]"
          >
            ×
          </button>
        </header>

        {/* Modal content */}
        <div className="overflow-y-auto p-5 sm:p-6">{children}</div>
      </section>
    </div>
  );
}
