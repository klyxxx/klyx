import Navbar from "./ui/Navbar";
import Hero from "./ui/Hero";
import Features from "./ui/Features";
import HowItWorks from "./ui/HowItWorks";
import Pricing from "./ui/Pricing";
import Footer from "./ui/Footer";

export default function Home() {
  return (
    <main className="bg-black text-white min-h-screen">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <Footer />
    </main>
  );
}