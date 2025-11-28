import React from 'react';
import { IconBuilding, IconServer, IconLock, IconFileText } from './icons/Icons';

const CustomSetup: React.FC = () => {
  return (
    <section className="py-24 border-y border-rnrGrey-80 bg-background relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 bg-[url('/swm-pattern.png')] bg-cover bg-center opacity-50 pointer-events-none"></div>

        <div className="relative max-w-4xl mx-auto px-4 text-center z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-rnrGrey-0/5 border border-rnrGrey-0/10 rounded-full text-xs font-medium text-rnrGrey-30 mb-6 backdrop-blur-sm">
                <IconBuilding className="w-4 h-4" />
                Enterprise & Brownfield
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold text-rnrGrey-0 mb-6">Need a Custom Setup?</h2>
            
            <p className="text-rnrGrey-40 text-lg mb-10 max-w-2xl mx-auto">
                For enterprise and brownfield projects that require self-hosted Maven repositories, 
                private access configuration, or custom library builds—we're here to help.
            </p>

            <div className="flex flex-wrap justify-center gap-6 text-sm text-rnrGrey-30 mb-10 font-medium">
                <span className="flex items-center gap-2">
                    <IconServer className="w-5 h-5 text-brandYellow-100" /> Self-hosted Maven
                </span>
                <span className="flex items-center gap-2">
                    <IconLock className="w-5 h-5 text-brandGreen-100" /> Private Repository Access
                </span>
                <span className="flex items-center gap-2">
                    <IconFileText className="w-5 h-5 text-brandPink-100" /> Custom Configurations
                </span>
            </div>

            <button className="bg-brandSeaBlue-100 hover:bg-brandSeaBlue-80 text-black font-semibold py-3 px-8 rounded-sm transition-colors">
                Contact Software Mansion <span className="ml-1">→</span>
            </button>
            
            <p className="mt-8 text-xs text-rnrGrey-50">
                RNRepo is built and maintained by <a href="#" className="text-brandSeaBlue-100 hover:underline">Software Mansion</a>
            </p>
        </div>
    </section>
  );
};

export default CustomSetup;