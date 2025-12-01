import React from 'react';
import { Icon } from './Icon';
import { Logo } from './Logo';

const Hero: React.FC = () => {
  return (
    <div className="relative pt-32 pb-16 sm:pt-40 sm:pb-24 overflow-hidden border-b border-rnrGrey-80">
      {/* Background pattern */}
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: 'url(/swm-pattern.png)' }}
      ></div>

      {/* Gradient overlay at top to fade out grid */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-background to-transparent"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
        <div className="flex items-center gap-4 mb-8">
          <span className="text-base text-white">Created by</span>
          <Logo name="swm" className="h-12 w-auto text-white" />
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-rnrGrey-0 mb-6 leading-tight">
          A Repository for React
          <br />
          Native{' '}
          <span className="text-brandSeaBlue-100">Pre-Built Artifacts</span>
        </h1>

        <p className="text-lg md:text-xl text-rnrGrey-40 max-w-2xl mb-10 leading-relaxed">
          Speed up your builds and avoid compiling native libraries from
          scratch. RNRepo delivers pre-built artifacts so you can focus on
          building your app.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-20">
          <a
            href="#setup"
            className="h-12 px-8 bg-brandSeaBlue-100 hover:bg-brandSeaBlue-80 text-black font-semibold rounded-sm transition-colors flex items-center justify-center gap-2"
          >
            Get Started <span className="text-black/60">→</span>
          </a>
          <a
            href="https://github.com/software-mansion/rnrepo"
            target="_blank"
            rel="noopener noreferrer"
            className="h-12 px-8 bg-surfaceHighlight border border-rnrGrey-60 hover:bg-rnrGrey-60 text-rnrGrey-0 font-medium rounded-sm transition-colors flex items-center justify-center"
          >
            View on GitHub <span className="ml-2 text-rnrGrey-40">→</span>
          </a>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-5xl">
          <StatCard
            icon={<Icon name="speed" className="w-6 h-6 text-brandPink-100" />}
            title="Up to 5x"
            subtitle="Faster Builds"
          />
          <StatCard
            icon={
              <Icon
                name="open-source"
                className="w-6 h-6 text-brandYellow-100"
              />
            }
            title="100%"
            subtitle="Open Source"
          />
          <StatCard
            icon={
              <Icon name="shield" className="w-6 h-6 text-brandSeaBlue-100" />
            }
            title="GPG"
            subtitle="Signed Artifacts"
          />
          <StatCard
            icon={<Icon name="box" className="w-6 h-6 text-brandGreen-100" />}
            title="Minimal"
            subtitle="Setup Required"
          />
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}> = ({ icon, title, subtitle }) => (
  <div className="bg-surface/50 border border-rnrGrey-80 p-6 rounded-sm flex flex-col items-center justify-center backdrop-blur-sm group hover:border-rnrGrey-60 transition-colors">
    <div className="mb-3 w-10 h-10 flex items-center justify-center bg-rnrGrey-0/5 rounded-full group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <div className="text-2xl font-bold text-rnrGrey-0 mb-1">{title}</div>
    <div className="text-sm text-rnrGrey-50 font-medium uppercase tracking-wide">
      {subtitle}
    </div>
  </div>
);

export default Hero;
