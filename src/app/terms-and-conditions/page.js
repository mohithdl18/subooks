
export const metadata = {
  title: "Terms and Conditions | SU VILLA",
  description:
    "Read the booking, payment, cancellation and guest policies for SU VILLA.",
};

const sections = [
  {
    title: "1. Booking and Reservations",
    content: [
      "All reservations are subject to availability and confirmation by SU VILLA.",
      "Guests must provide accurate contact information and booking details when making a reservation.",
      "A reservation is considered confirmed only after the required payment has been successfully completed and confirmation has been issued.",
      "The guest making the reservation is responsible for ensuring that all members of their party comply with these terms.",
    ],
  },
  {
    title: "2. Guest Information and Occupancy",
    content: [
      "Guests must provide accurate information about the number of adults and children staying at the property.",
      "Room occupancy limits must be followed. Additional guests are subject to the applicable charges and property rules.",
      "Children's accommodation charges, complimentary stays and extra-bed arrangements are governed by the rates and policies displayed during booking.",
      "SU VILLA may request valid identification from guests as required by applicable law.",
    ],
  },
  {
    title: "3. Pricing, Taxes and Additional Charges",
    content: [
      "The booking summary displays the applicable accommodation charges, selected add-ons, discounts, taxes and platform fees.",
      "Any additional charges must be disclosed to the guest before payment or incurred in accordance with the applicable property policies.",
      "Promotional codes are subject to their stated eligibility requirements, validity periods and usage restrictions.",
      "A promotional discount applies only as specified in the offer. It cannot be exchanged for cash unless the offer expressly permits it.",
    ],
  },
  {
    title: "4. Payments",
    content: [
      "Payments must be completed through the payment methods offered during checkout.",
      "A booking is not confirmed merely because a payment attempt has been initiated.",
      "Payment confirmation is subject to successful processing by the payment provider.",
      "If a payment is deducted but the booking is not confirmed, contact SU VILLA with the transaction reference so the payment and reservation status can be reviewed.",
    ],
  },
  {
    title: "5. Check-in and Check-out",
    content: [
      "Check-in and check-out times are those communicated by SU VILLA for the confirmed reservation.",
      "Early check-in and late check-out are subject to availability and may incur additional charges.",
      "Guests should contact the property in advance if they expect to arrive late or require a change to their arrival arrangements.",
    ],
  },
  {
    title: "6. Cancellation, Changes and Refunds",
    content: [
      "Cancellation charges and refund eligibility depend on the cancellation policy applicable to the reservation.",
      "Requests to change booking dates, guest counts or accommodation selections are subject to availability and any applicable price difference.",
      "Where a refund is approved, the amount and processing time will depend on the applicable policy and payment provider.",
      "The specific cancellation deadline, refund percentage and any non-refundable charges must be communicated to the guest before the booking is confirmed.",
    ],
  },
  {
    title: "7. Guest Conduct and Property Care",
    content: [
      "Guests must respect the property, its staff, other guests and the surrounding environment.",
      "Guests are responsible for damage caused by them or members of their party, subject to applicable law and the property's disclosed policies.",
      "Illegal activities, unsafe conduct and behaviour that materially disrupts other guests are not permitted.",
      "Guests must follow any reasonable safety instructions and property rules communicated by SU VILLA.",
    ],
  },
  {
    title: "8. Add-on Services",
    content: [
      "Meals, driver accommodation and other optional services are provided only when selected or separately confirmed.",
      "Availability, service timings and applicable charges may vary. Any material changes should be communicated to the guest.",
      "Special requests are subject to confirmation and are not guaranteed unless expressly accepted by SU VILLA.",
    ],
  },
  {
    title: "9. Privacy and Personal Information",
    content: [
      "Information supplied during booking may be used to process reservations, communicate booking updates, provide requested services and meet legal obligations.",
      "Personal information should be handled in accordance with the applicable privacy policy and data protection laws.",
      "Payment card details should be processed through the designated payment provider rather than stored unnecessarily by the property.",
    ],
  },
  {
    title: "10. Changes and Applicable Law",
    content: [
      "These terms may be updated when necessary. The terms applicable to a reservation should be made available to the guest at the time of booking.",
      "Nothing in these terms limits rights or remedies that cannot legally be excluded.",
      "These terms are subject to applicable Indian law. Any dispute will be handled by the competent courts or authorities as provided by applicable law.",
    ],
  },
];

export default function TermsAndConditionsPage() {
  return (
    <main className="min-h-screen bg-[#F7FAEE] px-4 py-12 text-[#052a50] sm:px-8 sm:py-16">
      <article className="mx-auto max-w-4xl">
        <a
          href="/bookings"
          className="inline-flex items-center gap-2 text-sm font-medium hover:text-[#B34325]"
        >
          <span aria-hidden="true">←</span>
          Back to booking
        </a>

        <header className="mb-10 mt-8 border-b border-[#052a50]/15 pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#B34325]">
            SU VILLA
          </p>

          <h1 className="mt-3 font-display text-3xl sm:text-5xl">
            Terms and Conditions
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#052a50]/70 sm:text-base">
            Please read these terms carefully before completing your
            reservation. They describe the general conditions for using
            the SU VILLA booking service.
          </p>

          <p className="mt-3 text-xs text-[#052a50]/55">
            Draft policy — review and approve before publishing.
          </p>
        </header>

        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold sm:text-xl">
                {section.title}
              </h2>

              <div className="mt-3 space-y-3">
                {section.content.map((paragraph, index) => (
                  <p
                    key={index}
                    className="text-sm leading-7 text-[#052a50]/75 sm:text-base"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-12 border-t border-[#052a50]/15 pt-6">
          <p className="text-sm leading-6 text-[#052a50]/65">
            For questions about a reservation or these terms, please
            contact SU VILLA using the official contact details published
            on the website.
          </p>

          <a
            href="/bookings"
            className="mt-6 inline-flex rounded-xl bg-[#052a50] px-6 py-3 font-semibold text-white transition hover:bg-[#B34325]"
          >
            Return to booking
          </a>
        </footer>
      </article>
    </main>
  );
}
