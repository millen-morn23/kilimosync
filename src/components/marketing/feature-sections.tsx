import Image from "next/image";
import {
  BadgeCheck,
  Bot,
  ShieldCheck,
  Smartphone,
  Sprout,
  ShoppingBasket,
} from "lucide-react";

import { getFeaturedProducts } from "@/lib/data/products";
import { renderCategoryIcon, getCategoryTint } from "@/lib/category-icons";
import { FeatureRow, FeatureVisualPanel } from "@/components/marketing/feature-row";
import { Badge } from "@/components/ui/badge";

export async function ForFarmers() {
  const [sample] = await getFeaturedProducts(1);

  return (
    <FeatureRow
      id="for-farmers"
      eyebrow="For Farmers"
      title="Sell directly to buyers, at your price"
      description="List your produce in minutes and reach buyers across your county and beyond — without a broker taking the margin."
      bullets={[
        "Create listings with photos, price and available quantity",
        "Track orders and payments from one dashboard",
        "Get a verification badge that builds buyer trust",
        "Manage stock so you never oversell",
      ]}
      visual={
        <FeatureVisualPanel>
          {sample ? (
            <>
              <span
                className={`relative flex size-11 items-center justify-center overflow-hidden rounded-lg ${
                  sample.images[0] ? "bg-accent/50" : getCategoryTint(sample.category_icon)
                }`}
              >
                {sample.images[0] ? (
                  <Image src={sample.images[0]} alt={sample.name} fill className="object-cover" unoptimized />
                ) : (
                  renderCategoryIcon(sample.category_icon, { className: "size-5", strokeWidth: 1.75 })
                )}
              </span>
              <p className="mt-4 text-sm font-medium text-foreground">
                {sample.name} — KES {sample.price} / {sample.price_unit}
              </p>
              <p className="text-sm text-muted-foreground">
                {sample.quantity_available} {sample.quantity_unit} available · {sample.farm_name}
              </p>
            </>
          ) : (
            <>
              <Sprout className="size-10 text-primary" />
              <p className="mt-4 text-sm font-medium text-foreground">Your listing here</p>
              <p className="text-sm text-muted-foreground">Be one of the first farmers to list</p>
            </>
          )}
        </FeatureVisualPanel>
      }
    />
  );
}

export function ForBuyers() {
  return (
    <FeatureRow
      id="for-buyers"
      eyebrow="For Buyers"
      title="Discover fresh produce, priced fairly"
      description="Search, filter and buy directly from verified farmers — with M-PESA checkout and clear delivery details."
      reverse
      bullets={[
        "Filter by category, location, price and availability",
        "See a verification badge before you buy",
        "Pay securely with M-PESA",
        "Track your order from confirmation to delivery",
      ]}
      visual={
        <FeatureVisualPanel>
          <ShoppingBasket className="size-10 text-secondary-foreground" />
          <p className="mt-4 text-sm font-medium text-foreground">
            Fresh produce, sorted by distance
          </p>
          <p className="text-sm text-muted-foreground">Nairobi · Kiambu · Murang&apos;a</p>
        </FeatureVisualPanel>
      }
    />
  );
}

export function FarmerVerification() {
  return (
    <FeatureRow
      eyebrow="Trust & Safety"
      title="Every farmer can be verified"
      description="KilimoSync reviews farmer submissions before granting a verification badge, so buyers know who they're buying from."
      tone="accent"
      bullets={[
        "Admin review of farm details before verification",
        "Verified badge shown on every listing",
        "Suspicious accounts can be suspended",
        "Buyers can report issues through disputes",
      ]}
      visual={
        <FeatureVisualPanel>
          <ShieldCheck className="size-10 text-primary" />
          <div className="mt-4 flex items-center gap-2">
            <Badge variant="success" className="gap-1">
              <BadgeCheck className="size-3.5" />
              Verified farmer
            </Badge>
          </div>
        </FeatureVisualPanel>
      }
    />
  );
}

export function MpesaPayments() {
  return (
    <FeatureRow
      eyebrow="Payments"
      title="Pay with M-PESA, securely"
      description="Checkout uses the Safaricom Daraja STK Push — buyers confirm on their phone, and payment status is only ever set from a verified Safaricom callback."
      reverse
      bullets={[
        "STK Push sent straight to the buyer's phone",
        "Orders only confirm on verified payment",
        "Full payment history for every order",
        "No payment secrets ever reach the browser",
      ]}
      visual={
        <FeatureVisualPanel>
          <Smartphone className="size-10 text-primary" />
          <p className="mt-4 text-sm font-medium text-foreground">Check your phone</p>
          <p className="text-sm text-muted-foreground">Enter M-PESA PIN to complete payment</p>
        </FeatureVisualPanel>
      }
    />
  );
}

export function AiMarketplace() {
  return (
    <FeatureRow
      eyebrow="Intelligence"
      title="KilimoSync AI, built into the marketplace"
      description="An assistant for buyers, farmers and admins — grounded in real marketplace data, never invented listings."
      tone="accent"
      bullets={[
        "Buyers: “Show me tomatoes under KES 100/kg near Nairobi”",
        "Farmers: “Help me write a description for my potatoes”",
        "Admins: “How many payments failed today?”",
        "Every answer respects the same permissions as the app",
      ]}
      visual={
        <FeatureVisualPanel>
          <Bot className="size-10 text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">
            &ldquo;What can I buy for KES 1,000?&rdquo;
          </p>
        </FeatureVisualPanel>
      }
    />
  );
}
