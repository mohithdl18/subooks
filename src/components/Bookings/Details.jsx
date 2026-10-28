
"use client";

import { useState } from "react";

const COLORS = {
  background: "#F7FAEE",
  foreground: "#052a50",
  accent: "#e4b441",
};

function Field({
  label,
  name,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
  required = true,
  inputMode,
  maxLength,
  autoComplete = "off",
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={name}
        className="text-sm font-medium text-[#052a50]"
      >
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-[#052a50] outline-none transition placeholder:text-[#052a50]/40 focus:border-[#e4b441] ${
          error ? "border-red-500" : "border-[#052a50]/15"
        }`}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function Details({
  initialDetails = {},
  onBack,
  onNext,
}) {
  const [formData, setFormData] = useState({
    name: initialDetails.name || "",
    email: initialDetails.email || "",
    phone: (initialDetails.phone || "").replace(/^\+91/, "").slice(0, 10),
    address: initialDetails.address || "",
    city: initialDetails.city || "",
    pincode: initialDetails.pincode || "",
    aadharNumber: initialDetails.aadharNumber || "",
    specialRequests: initialDetails.specialRequests || "",
  });

  const [errors, setErrors] = useState({});

  function handleChange(event) {
    const { name, value } = event.target;
    let updatedValue = value;

    if (name === "phone") {
      updatedValue = value.replace(/\D/g, "").slice(0, 10);
    }

    if (name === "pincode") {
      updatedValue = value.replace(/\D/g, "").slice(0, 6);
    }

    if (name === "aadharNumber") {
      updatedValue = value.replace(/\D/g, "").slice(0, 12);
    }

    setFormData((previous) => ({
      ...previous,
      [name]: updatedValue,
    }));

    setErrors((previous) => ({
      ...previous,
      [name]: "",
    }));
  }

  function validateForm() {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Please enter your full name.";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Please enter your email address.";
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())
    ) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!/^\d{10}$/.test(formData.phone)) {
      newErrors.phone = "Phone number must contain exactly 10 digits.";
    }

    if (!formData.address.trim()) {
      newErrors.address = "Please enter your billing address.";
    }

    if (!formData.city.trim()) {
      newErrors.city = "Please enter your city.";
    }

    if (!/^\d{6}$/.test(formData.pincode)) {
      newErrors.pincode = "Pincode must contain exactly 6 digits.";
    }

    if (!/^\d{12}$/.test(formData.aadharNumber)) {
      newErrors.aadharNumber =
        "Aadhaar number must contain exactly 12 digits.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleNext() {
    if (!validateForm()) return;

    onNext?.({
      ...formData,
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: `+91${formData.phone}`,
      address: formData.address.trim(),
      city: formData.city.trim(),
      pincode: formData.pincode,
      aadharNumber: formData.aadharNumber,
      specialRequests: formData.specialRequests.trim(),
    });
  }

  return (
    <div className="space-y-7">
      {/* Heading */}
      <section>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-[#052a50]">
            Your Details
          </h3>
          <p className="mt-1 text-sm text-[#052a50]/60">
            Enter your contact and billing details to continue with your
            booking. Fields marked with{" "}
            <span className="text-red-600">*</span> are required.
          </p>
        </div>

        {/* Contact details */}
        <div className="rounded-2xl border border-[#052a50]/10 bg-white p-4 sm:p-5">
          <h4 className="mb-4 font-semibold text-[#052a50]">
            Contact Information
          </h4>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label="Full Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              placeholder="Enter your full name"
              autoComplete="name"
            />

            <Field
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              placeholder="you@example.com"
              autoComplete="email"
            />

            <div className="flex flex-col gap-2">
              <label
                htmlFor="phone"
                className="text-sm font-medium text-[#052a50]"
              >
                Phone Number <span className="text-red-600">*</span>
              </label>

              <div
                className={`flex overflow-hidden rounded-xl border bg-white transition focus-within:border-[#e4b441] ${
                  errors.phone
                    ? "border-red-500"
                    : "border-[#052a50]/15"
                }`}
              >
                <div className="flex items-center border-r border-[#052a50]/10 bg-[#052a50]/5 px-3 text-sm font-medium text-[#052a50]">
                  🇮🇳 +91
                </div>

                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={10}
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="10-digit number"
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-[#052a50] outline-none placeholder:text-[#052a50]/40"
                />
              </div>

              {errors.phone && (
                <p className="text-xs text-red-600">{errors.phone}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Billing details */}
      <section>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-[#052a50]">
            Billing Information
          </h3>
          <p className="mt-1 text-sm text-[#052a50]/60">
            Provide the address details associated with your booking.
          </p>
        </div>

        <div className="rounded-2xl border border-[#052a50]/10 bg-white p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field
                label="Billing Address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                error={errors.address}
                placeholder="House number, street, area"
                autoComplete="street-address"
              />
            </div>

            <Field
              label="City"
              name="city"
              value={formData.city}
              onChange={handleChange}
              error={errors.city}
              placeholder="Enter your city"
              autoComplete="address-level2"
            />

            <Field
              label="Pincode"
              name="pincode"
              value={formData.pincode}
              onChange={handleChange}
              error={errors.pincode}
              placeholder="6-digit pincode"
              inputMode="numeric"
              maxLength={6}
              autoComplete="postal-code"
            />
          </div>
        </div>
      </section>

      {/* Identity details */}
      <section>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-[#052a50]">
            Identity Information
          </h3>
          <p className="mt-1 text-sm text-[#052a50]/60">
            Enter your Aadhaar number if it is required for your booking.
          </p>
        </div>

        <div className="rounded-2xl border border-[#052a50]/10 bg-white p-4 sm:p-5">
          <Field
            label="Aadhaar Number"
            name="aadharNumber"
            value={formData.aadharNumber}
            onChange={handleChange}
            error={errors.aadharNumber}
            placeholder="Enter your 12-digit Aadhaar number"
            inputMode="numeric"
            maxLength={12}
          />

          <p className="mt-2 text-xs leading-relaxed text-[#052a50]/60">
            For security purposes only. Your information should be handled
            securely and used only for the stated purpose.
          </p>
        </div>
      </section>

      {/* Special requests */}
      <section>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-[#052a50]">
            Special Requests
            <span className="ml-2 text-sm font-normal text-[#052a50]/50">
              (Optional)
            </span>
          </h3>
          <p className="mt-1 text-sm text-[#052a50]/60">
            Let us know if there is anything you would like us to know before
            your stay.
          </p>
        </div>

        <div className="rounded-2xl border border-[#052a50]/10 bg-white p-4 sm:p-5">
          <textarea
            id="specialRequests"
            name="specialRequests"
            value={formData.specialRequests}
            onChange={handleChange}
            placeholder="Enter any special requests..."
            rows={4}
            className="w-full resize-y rounded-xl border border-[#052a50]/15 bg-white px-4 py-3 text-sm text-[#052a50] outline-none transition placeholder:text-[#052a50]/40 focus:border-[#e4b441]"
          />
        </div>
      </section>

      {/* Navigation */}
      <div className="flex gap-3 border-t border-[#052a50]/10 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-xl border border-[#052a50]/20 bg-white px-4 py-3.5 text-sm font-semibold text-[#052a50] transition hover:bg-[#052a50]/5"
        >
          Back
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="flex-1 rounded-xl bg-[#052a50] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#e4b441] hover:text-[#052a50]"
        >
          Next
        </button>
      </div>
    </div>
  );
}
