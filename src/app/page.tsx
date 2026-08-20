import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Hero } from "@/components/marketing/hero";
import { ProblemSolution } from "@/components/marketing/problem-solution";
import { HowItWorks } from "@/components/marketing/how-it-works";
import {
  AiMarketplace,
  FarmerVerification,
  ForBuyers,
  ForFarmers,
  MpesaPayments,
} from "@/components/marketing/feature-sections";
import { FeaturedProduce } from "@/components/marketing/featured-produce";
import { WhyKilimoSync } from "@/components/marketing/why-kilimosync";
import { Testimonials } from "@/components/marketing/testimonials";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <ProblemSolution />
        <HowItWorks />
        <ForFarmers />
        <ForBuyers />
        <FeaturedProduce />
        <FarmerVerification />
        <MpesaPayments />
        <AiMarketplace />
        <WhyKilimoSync />
        <Testimonials />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
