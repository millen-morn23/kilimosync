const FAQS = [
  {
    question: "How do I know a farmer is legitimate?",
    answer:
      "Farmers who complete our verification process receive a verified badge shown on their profile and listings. Verification is reviewed by the KilimoSync team.",
  },
  {
    question: "How do I pay for an order?",
    answer:
      "Checkout uses M-PESA. You'll receive an STK push on your phone — enter your M-PESA PIN to complete payment. Your order is only confirmed once Safaricom verifies the payment.",
  },
  {
    question: "What happens if my payment fails?",
    answer:
      "If the STK push fails, times out, or is cancelled, your order stays unpaid and no inventory is deducted. You can retry checkout at any time.",
  },
  {
    question: "How do farmers get paid?",
    answer:
      "Payments are tracked per order and reconciled by the KilimoSync team during the pilot phase, with a configurable platform commission deducted per transaction.",
  },
  {
    question: "Is there a fee to sell on KilimoSync?",
    answer:
      "KilimoSync takes a small, transparent commission on completed sales. There's no cost to create a farmer account or list produce.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-3xl font-semibold tracking-tight text-foreground">
          Frequently asked questions
        </h2>
        <dl className="mt-12 divide-y divide-border">
          {FAQS.map((faq) => (
            <div key={faq.question} className="py-6">
              <dt className="text-base font-semibold text-foreground">{faq.question}</dt>
              <dd className="mt-2 text-sm text-muted-foreground">{faq.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
