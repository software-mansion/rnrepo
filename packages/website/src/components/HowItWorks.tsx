import React from 'react';
import { IconBox, IconClock, IconServer, IconCheck, IconGitBranch, IconArrowDown } from './icons/Icons';
import { SectionHeader } from './SectionHeader';

const HowItWorks: React.FC = () => {
  return (
    <section id="how-it-works" className="py-16 bg-background border-b border-rnrGrey-80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-12 max-w-2xl">
            <SectionHeader
              title="How It Works"
              subtitle="A fully automated, transparent pipeline from source to prebuilt artifacts."
            />
        </div>

        {/* Vertical Steps List */}
        <div className="flex flex-col mb-12">
            <StepItem
                icon={<IconGitBranch />}
                title="Library Configuration"
                description="Our GitHub repository maintains a curated list of React Native libraries and supported versions in libraries.json."
                colorClass="text-brandSeaBlue-100 border-brandSeaBlue-100"
            />
            <ArrowSeparator />
            <StepItem
                icon={<IconClock />}
                title="Automated Detection"
                description="A cron job continuously monitors for new library releases and React Native versions, scheduling builds automatically."
                colorClass="text-brandGreen-100 border-brandGreen-100"
            />
            <ArrowSeparator />
            <StepItem
                icon={<IconServer />}
                title="Isolated Builds"
                description="Each library is built against specific React Native versions in isolated GitHub workflow —fully transparent and traceable."
                colorClass="text-brandYellow-100 border-brandYellow-100"
            />
            <ArrowSeparator />
            <StepItem
                icon={<IconBox />}
                title="Maven Publishing"
                description={
                    <>
                    Built artifacts are GPG-signed and published to our public <a href="#" className="underline hover:text-white transition-colors">Maven repository here</a>.
                    </>
                }
                colorClass="text-brandPink-100 border-brandPink-100"
            />
            <ArrowSeparator />
            <StepItem
                icon={<IconCheck />}
                title="ClientFetching"
                description="When you build your app, the RNRepo plugin fetches pre-built artifacts instead of compiling from source."
                colorClass="text-brandSeaBlue-100 border-brandSeaBlue-100"
            />
        </div>

        {/* Full Width Verification Card */}
        <div className="bg-[#111] border border-rnrGrey-80 p-6 md:p-8 rounded-sm relative overflow-hidden group">
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="max-w-2xl">
                    <h3 className="text-2xl font-medium text-rnrGrey-0 mb-4">Transparent & Verifiable</h3>
                    <p className="text-base text-rnrGrey-40 leading-relaxed">
                        Every artifact includes a link to its build workflow. You can verify the exact commit, build logs, and GPG signature of any prebuilt library.
                        <br/><br/>
                        No hidden steps, no black boxes.
                    </p>
                </div>

                {/* Checkmark Graphic */}
                <div className="shrink-0">
                     <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-[8px] border-brandGreen-100 flex items-center justify-center opacity-90">
                        <svg className="w-12 h-12 md:w-16 md:h-16 text-brandGreen-100" fill="none" stroke="currentColor" strokeWidth="4" viewBox="0 0 24 24">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                     </div>
                </div>
            </div>
        </div>

      </div>
    </section>
  );
};

const StepItem: React.FC<{ icon: React.ReactNode; title: string; description: React.ReactNode; colorClass: string }> = ({ icon, title, description, colorClass }) => (
    <div className="flex gap-6 items-start">
        <div className={`w-12 h-12 border rounded-sm flex items-center justify-center shrink-0 ${colorClass}`}>
             <div className="w-5 h-5 flex items-center justify-center">{icon}</div>
        </div>
        <div className="">
            <h3 className="text-lg font-medium text-rnrGrey-0 mb-1">{title}</h3>
            <p className="text-sm text-rnrGrey-40 leading-relaxed max-w-xl">{description}</p>
        </div>
    </div>
);

const ArrowSeparator: React.FC = () => (
    <div className="flex gap-6">
        <div className="w-12 flex justify-center pt-1 pb-2">
            <IconArrowDown className="text-rnrGrey-60 w-5 h-5" />
        </div>
    </div>
);

export default HowItWorks;