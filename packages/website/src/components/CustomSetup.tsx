import React from 'react';
import { SectionHeader } from './SectionHeader';
import { Icon } from './Icon';

const CustomSetup: React.FC = () => {
  return (
    <section className="py-24 border-y border-rnrGrey-80 bg-background relative overflow-hidden">
      {/* Background pattern */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-50 pointer-events-none"
        style={{ backgroundImage: 'url(/swm-pattern.png)' }}
      ></div>

      <div className="relative max-w-4xl mx-auto px-4 text-center z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-rnrGrey-0/5 border border-rnrGrey-0/10 rounded-full text-xs font-medium text-rnrGrey-30 mb-6 backdrop-blur-sm">
          <Icon name="building" className="w-4 h-4" />
          Enterprise & Brownfield
        </div>

        <SectionHeader
          title="Need a Custom Setup?"
          subtitle="For enterprise and brownfield projects that require self-hosted Maven repositories, private access configuration, or custom library builds—we're here to help."
          className="text-center"
          subtitleClassName="max-w-2xl mx-auto mb-10"
        />

        <div className="flex flex-wrap justify-center gap-6 text-sm text-rnrGrey-30 mb-10 font-medium">
          <span className="flex items-center gap-2">
            <Icon name="server" className="w-5 h-5 text-brandYellow-100" />{' '}
            Self-hosted Maven
          </span>
          <span className="flex items-center gap-2">
            <Icon name="lock" className="w-5 h-5 text-brandGreen-100" /> Private
            Repository Access
          </span>
          <span className="flex items-center gap-2">
            <Icon name="file-text" className="w-5 h-5 text-brandPink-100" />{' '}
            Custom Configurations
          </span>
        </div>

        <a
          href="https://swmansion.com/contact"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-brandSeaBlue-100 hover:bg-brandSeaBlue-80 text-black font-semibold py-3 px-8 rounded-sm transition-colors inline-flex items-center justify-center"
        >
          Contact Software Mansion <span className="ml-1">→</span>
        </a>

        <p className="mt-8 text-xs text-rnrGrey-50">
          RNRepo is built and maintained by{' '}
          <a
            href="https://swmansion.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brandSeaBlue-100 hover:underline"
          >
            Software Mansion
          </a>
        </p>
      </div>
    </section>
  );
};

export default CustomSetup;
