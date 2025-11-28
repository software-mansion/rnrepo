import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import GettingStarted from './components/GettingStarted';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import CustomSetup from './components/CustomSetup';
import FAQ from './components/FAQ';
import Footer from './components/Footer';

function App() {
  return (
    <div className="min-h-screen bg-background text-rnrGrey-0 font-sans selection:bg-brandSeaBlue-100 selection:text-black">
      <Navbar />
      <main>
        <Hero />
        <GettingStarted />
        <Features />
        <HowItWorks />
        <CustomSetup />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}

export default App;