import React from 'react';
import { RNRepoLogo } from './icons/Icons';

const Navbar: React.FC = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-rnrGrey-80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <RNRepoLogo className="h-8 w-auto text-rnrGrey-0" />
            <span className="text-[10px] font-bold bg-rnrGrey-0 text-black px-1.5 py-0.5 rounded-sm self-start mt-1">BETA</span>
          </div>

          <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-rnrGrey-40">
            <a href="#setup" className="hover:text-rnrGrey-0 transition-colors">Setup</a>
            <a href="#benefits" className="hover:text-rnrGrey-0 transition-colors">Benefits</a>
            <a href="#how-it-works" className="hover:text-rnrGrey-0 transition-colors">How It Works</a>
            <a href="#faq" className="hover:text-rnrGrey-0 transition-colors">FAQ</a>

            <a
              href="https://github.com/software-mansion/rnrepo"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-surfaceHighlight hover:bg-rnrGrey-60 text-rnrGrey-0 px-4 py-2 rounded-sm border border-rnrGrey-60 transition-all text-xs uppercase tracking-wide"
            >
              View on GitHub
              <span className="text-rnrGrey-40">→</span>
            </a>
          </div>

          <div className="md:hidden">
              {/* Mobile menu button placeholder */}
              <button className="text-rnrGrey-40 hover:text-rnrGrey-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>
              </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;