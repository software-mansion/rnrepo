import React from 'react';
import { IconSpeed, IconPhone, IconFolder, IconBox, IconShield } from './icons/Icons';

const Features: React.FC = () => {
  return (
    <section id="benefits" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
                <h2 className="text-4xl font-bold text-rnrGrey-0 mb-4">Why RNRepo?</h2>
                <p className="text-rnrGrey-40">Built for React Native developers who value speed, security, and simplicity.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <FeatureCard 
                    icon={<IconSpeed className="text-brandPink-100" />}
                    title="5x Faster Android Builds"
                    description="Skip compiling native code from source. RNRepo provides pre-built artifacts that dramatically reduce your build times."
                />
                 <FeatureCard 
                    icon={<IconPhone className="text-brandYellow-100" />}
                    title="Simplified Brownfield Projects"
                    description="No more managing complex React Native dependency lists. Just reference the prebuilt artifacts and focus on your app."
                />
                 <FeatureCard 
                    icon={<IconFolder className="text-brandSeaBlue-100" />}
                    title="Reduced Disk Space"
                    description="Build directories are smaller because they don't need to contain intermediate build artifacts. Save gigabytes on your CI machines."
                />
                 <FeatureCard 
                    icon={<IconBox className="text-brandSeaBlue-60" />}
                    title="Optimized Release Builds"
                    description="Our published artifacts are release builds, better optimized than the debug builds you'd typically compile from source."
                />
                 <FeatureCard 
                    icon={<IconShield className="text-brandGreen-100" />}
                    title="Security First"
                    description="Isolated GitHub workflows, transparent builds, traceable artifacts, and GPG signing ensure your builds are secure and tamper-proof."
                />
            </div>
        </div>
    </section>
  );
};

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
    <div className="bg-surface/40 border border-rnrGrey-80 hover:border-rnrGrey-60 p-8 rounded-sm transition-colors group">
        <div className="mb-6 w-12 h-12 bg-rnrGrey-0/5 rounded-lg flex items-center justify-center group-hover:bg-rnrGrey-0/10 transition-colors">
            {icon}
        </div>
        <h3 className="text-xl font-semibold text-rnrGrey-0 mb-3">{title}</h3>
        <p className="text-rnrGrey-40 text-sm leading-relaxed">{description}</p>
    </div>
);

export default Features;