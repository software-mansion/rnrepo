import React from 'react';
import { RNRepoLogo, SoftwareMansionLogo, IconGithub, IconX, IconYoutube } from './icons/Icons';

const Footer: React.FC = () => {
  return (
    <footer className="bg-black pt-20 pb-10 border-t border-rnrGrey-80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col items-center text-center mb-16">
            <div className="mb-8">
                 <SoftwareMansionLogo className="h-16 w-auto text-rnrGrey-0" />
            </div>
            <h2 className="text-3xl font-bold text-rnrGrey-0 mb-4">We are Software Mansion</h2>
            <p className="text-rnrGrey-40 max-w-2xl leading-relaxed">
                We're a software company built around improving developer experience and bringing to life the innovative ideas of our clients.
            </p>
        </div>

        {/* CTA Box */}
        <div className="bg-[#111] border border-rnrGrey-80 p-8 rounded-sm flex flex-col md:flex-row items-center justify-between gap-6 mb-20 max-w-4xl mx-auto">
            <h3 className="text-xl font-medium text-rnrGrey-0 text-center md:text-left">
                Do you have a software project that we<br />can help you with?
            </h3>
            <button className="bg-brandSeaBlue-100 hover:bg-brandSeaBlue-80 text-black font-semibold px-6 py-3 rounded-sm transition-colors whitespace-nowrap">
                Learn more about us →
            </button>
        </div>

        {/* Social Links */}
        <div className="flex justify-center space-x-6 mb-16">
             <SocialLink href="#" icon={<IconX />} />
             <SocialLink href="#" icon={<IconGithub />} />
             <SocialLink href="#" icon={<IconYoutube />} />
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-rnrGrey-80 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-rnrGrey-50">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
                <RNRepoLogo className="h-5 w-auto text-rnrGrey-40" />
                <span className="bg-rnrGrey-0 text-black px-1 rounded-sm text-[10px] font-bold">BETA</span>
            </div>

            <div className="flex space-x-6 mb-4 md:mb-0">
                <a href="#" className="hover:text-rnrGrey-0 transition-colors">Setup</a>
                <a href="#" className="hover:text-rnrGrey-0 transition-colors">Benefits</a>
                <a href="#" className="hover:text-rnrGrey-0 transition-colors">FAQ</a>
                <a href="#" className="hover:text-rnrGrey-0 transition-colors flex items-center gap-1">
                    <IconGithub className="w-3 h-3" /> GitHub
                </a>
            </div>

            <div>
                Built by <a href="#" className="text-brandSeaBlue-100 hover:underline">Software Mansion</a>
            </div>
        </div>
      </div>
    </footer>
  );
};

const SocialLink: React.FC<{ href: string; icon: React.ReactNode }> = ({ href, icon }) => (
    <a href={href} className="w-10 h-10 bg-rnrGrey-0/10 rounded-full flex items-center justify-center text-rnrGrey-0 hover:bg-rnrGrey-0/20 transition-colors">
        <div className="w-5 h-5 flex items-center justify-center">{icon}</div>
    </a>
);

export default Footer;