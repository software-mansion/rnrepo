import React, { useState } from 'react';

const GettingStarted: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'standard' | 'expo'>('standard');

  return (
    <section id="setup" className="py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h2 className="text-4xl font-bold text-rnrGrey-0 mb-4">Getting Started</h2>
          <p className="text-rnrGrey-40 max-w-2xl">
            To start using RNRepo, you need to configure your Android project to include our Maven
            repository and use our Gradle plugin that will automatically swap out dependencies on
            supported libraries with pre-built artifacts downloaded from our repository.
          </p>
        </div>

        {/* Tab Switcher - Standalone */}
        <div className="relative h-14 w-full flex bg-[#1A1A1A] border border-rnrGrey-80 rounded-sm overflow-hidden mb-8">
            {/* Sliding Background */}
            <div 
                className={`absolute top-0 bottom-0 w-1/2 bg-brandSeaBlue-100 transition-transform duration-300 ease-in-out ${
                    activeTab === 'standard' ? 'translate-x-0' : 'translate-x-full'
                }`}
            />
            
            {/* Tab Buttons */}
            <button 
                onClick={() => setActiveTab('standard')}
                className={`relative z-10 w-1/2 h-full text-sm font-medium transition-colors duration-300 ${
                    activeTab === 'standard' ? 'text-black' : 'text-rnrGrey-40 hover:text-rnrGrey-20'
                }`}
            >
                Standard React Native
            </button>
            <button 
                onClick={() => setActiveTab('expo')}
                className={`relative z-10 w-1/2 h-full text-sm font-medium transition-colors duration-300 ${
                    activeTab === 'expo' ? 'text-black' : 'text-rnrGrey-40 hover:text-rnrGrey-20'
                }`}
            >
                Expo (CNG)
            </button>
        </div>

        {/* Code Block 1: android/build.gradle */}
        <div className="border border-rnrGrey-80 rounded-sm overflow-hidden bg-[#0D0D0D] mb-8">
            {/* File Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-rnrGrey-80 bg-[#141414]">
                <span className="text-xs text-rnrGrey-50 font-mono">android/build.gradle</span>
                <button className="flex items-center gap-1.5 text-xs text-rnrGrey-50 hover:text-rnrGrey-0 transition-colors group">
                    <svg className="w-3.5 h-3.5 group-hover:text-brandSeaBlue-100 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    Copy
                </button>
            </div>
            
            {/* Code Body */}
            <div className="p-6 overflow-x-auto bg-[#0A0A0A]">
                <pre className="text-sm font-mono leading-loose text-rnrGrey-30">
{activeTab === 'standard' ? (
<>
<span className="text-rnrGrey-0">buildscript</span> {'{'}
  ...
  <span className="text-rnrGrey-0">dependencies</span> {'{'}
    <span className="text-brandSeaBlue-100">+   ...</span>
    <span className="text-rnrGrey-30">    classpath(</span><span className="text-white">"org.rnrepo.tools:prebuilds-plugin:+"</span><span className="text-rnrGrey-30">)</span>
  {'}'}
{'}'}
<span className="block bg-brandSeaBlue-100/5 -mx-6 px-6 border-l-2 border-brandSeaBlue-100">
<span className="text-brandSeaBlue-100">+ apply plugin:</span> <span className="text-white">"com.facebook.react.rootproject"</span>
</span>
<span className="block bg-brandSeaBlue-100/5 -mx-6 px-6 border-l-2 border-brandSeaBlue-100 mt-1">
<span className="text-brandSeaBlue-100">+ repositories</span> {'{'}
</span>
<span className="block bg-brandSeaBlue-100/5 -mx-6 px-6 border-l-2 border-brandSeaBlue-100">
    maven {'{'} url <span className="text-white">"https://packages.rnrepo.org/releases"</span> {'}'}
</span>
<span className="block bg-brandSeaBlue-100/5 -mx-6 px-6 border-l-2 border-brandSeaBlue-100">
{'}'}
</span>
</>
) : (
<>
<span className="text-rnrGrey-50 italic">// Expo setup requires config plugin</span>

<span className="text-rnrGrey-0">plugin</span> {'{'}
<span className="block bg-brandSeaBlue-100/5 -mx-6 px-6 border-l-2 border-brandSeaBlue-100">
<span className="text-brandSeaBlue-100">    id</span> <span className="text-white">"org.rnrepo.expo-plugin"</span> <span className="text-brandSeaBlue-100">version</span> <span className="text-white">"1.0.0"</span>
</span>
{'}'}
</>
)}
                </pre>
            </div>
        </div>

        {/* Code Block 2: android/app/build.gradle */}
        <div className="border border-rnrGrey-80 rounded-sm overflow-hidden bg-[#0D0D0D]">
            <div className="flex items-center justify-between px-6 py-3 border-b border-rnrGrey-80 bg-[#141414]">
                <span className="text-xs text-rnrGrey-50 font-mono">android/app/build.gradle</span>
                <button className="flex items-center gap-1.5 text-xs text-rnrGrey-50 hover:text-rnrGrey-0 transition-colors group">
                    <svg className="w-3.5 h-3.5 group-hover:text-brandSeaBlue-100 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    Copy
                </button>
            </div>
            <div className="p-6 overflow-x-auto bg-[#0A0A0A]">
                    <pre className="text-sm font-mono leading-loose text-rnrGrey-30">
<span className="text-rnrGrey-30">apply plugin:</span> <span className="text-white">"com.android.application"</span>
<span className="text-rnrGrey-30">apply plugin:</span> <span className="text-white">"org.jetbrains.kotlin.android"</span>
<span className="text-rnrGrey-30">apply plugin:</span> <span className="text-white">"com.facebook.react"</span>
<span className="block bg-brandSeaBlue-100/5 -mx-6 px-6 border-l-2 border-brandSeaBlue-100 mt-1">
<span className="text-brandSeaBlue-100">+ apply plugin:</span> <span className="text-white">"org.rnrepo.tools.prebuilds-plugin"</span>
</span>
                </pre>
            </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-8 text-center p-8 bg-surfaceHighlight/20 border border-rnrGrey-80 rounded-sm">
            <h3 className="text-lg font-semibold text-rnrGrey-0 mb-2">That's it! Now build your app as usual and enjoy faster builds.</h3>
            <p className="text-sm text-rnrGrey-40">
                For detailed instructions, visit our <a href="https://github.com" className="text-rnrGrey-0 underline hover:text-rnrGrey-30 transition-colors">GitHub repository</a>.
            </p>
        </div>
      </div>
    </section>
  );
};

export default GettingStarted;