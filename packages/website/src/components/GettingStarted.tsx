import React from 'react';
import { SectionHeader } from './SectionHeader';
import styles from './GettingStarted.module.css';

const GettingStarted: React.FC = () => {
  return (
    <section id="setup" className="py-20 border-b border-rnrGrey-80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <SectionHeader
            title="Getting Started"
            subtitle="To start using RNRepo, you need to configure your Android project to include our Maven repository and use our Gradle plugin that will automatically swap out dependencies on supported libraries with pre-built artifacts downloaded from our repository."
            subtitleClassName="max-w-2xl"
          />
        </div>

        {/* Tab Switcher - Using Radio Buttons */}
        <div className={styles.tabWrapper}>
          <input
            type="radio"
            id="tab-standard"
            name="getting-started-tab"
            className={`${styles.tabRadio} ${styles.tabRadioStandard}`}
            defaultChecked
          />
          <input
            type="radio"
            id="tab-expo"
            name="getting-started-tab"
            className={`${styles.tabRadio} ${styles.tabRadioExpo}`}
          />
          <div className={styles.tabContainer}>
            <div className={styles.slidingBackground} />
            <label
              htmlFor="tab-standard"
              className={`${styles.tabLabel} ${styles.tabLabelStandard}`}
            >
              Standard React Native
            </label>
            <label
              htmlFor="tab-expo"
              className={`${styles.tabLabel} ${styles.tabLabelExpo}`}
            >
              Expo (CNG)
            </label>
          </div>

          {/* Code Block 1: android/build.gradle - Standard */}
          <div
            className={`${styles.codeBlockWrapper} ${styles.codeBlockWrapperStandard} border border-rnrGrey-80 rounded-sm overflow-hidden bg-[#0D0D0D] mb-8`}
          >
            {/* File Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-rnrGrey-80 bg-[#141414]">
              <span className="text-xs text-rnrGrey-50 font-mono">
                android/build.gradle
              </span>
              <button className="flex items-center gap-1.5 text-xs text-rnrGrey-50 hover:text-rnrGrey-0 transition-colors group">
                <svg
                  className="w-3.5 h-3.5 group-hover:text-brandSeaBlue-100 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy
              </button>
            </div>

            {/* Code Body */}
            <div className="p-6 overflow-x-auto bg-[#0A0A0A]">
              <pre className="text-sm font-mono leading-loose text-rnrGrey-30">
                <span className="text-rnrGrey-0">buildscript</span> {'{'}
                <br />
                {'  '}...
                <br />
                {'  '}
                <span className="text-rnrGrey-0">dependencies</span> {'{'}
                <br />
                <span className="text-brandSeaBlue-100">{'    '}+ ...</span>
                <br />
                <span className="text-rnrGrey-30">{'    '}classpath(</span>
                <span className="text-white">
                  "org.rnrepo.tools:prebuilds-plugin:+"
                </span>
                <span className="text-rnrGrey-30">)</span>
                <br />
                {'  '}
                {'}'}
                <br />
                {'}'}
                <br />
                <span className="block bg-brandSeaBlue-100/5 -mx-6 px-6 border-l-2 border-brandSeaBlue-100">
                  <span className="text-brandSeaBlue-100">+ apply plugin:</span>{' '}
                  <span className="text-white">
                    "com.facebook.react.rootproject"
                  </span>
                </span>
                <span className="block bg-brandSeaBlue-100/5 -mx-6 px-6 border-l-2 border-brandSeaBlue-100 mt-1">
                  <span className="text-brandSeaBlue-100">+ repositories</span>{' '}
                  {'{'}
                </span>
                <span className="block bg-brandSeaBlue-100/5 -mx-6 px-6 border-l-2 border-brandSeaBlue-100">
                  {'    '}maven {'{'} url{' '}
                  <span className="text-white">
                    "https://packages.rnrepo.org/releases"
                  </span>{' '}
                  {'}'}
                </span>
                <span className="block bg-brandSeaBlue-100/5 -mx-6 px-6 border-l-2 border-brandSeaBlue-100">
                  {'}'}
                </span>
              </pre>
            </div>
          </div>

          {/* Code Block 1: android/build.gradle - Expo */}
          <div
            className={`${styles.codeBlockWrapper} ${styles.codeBlockWrapperExpo} border border-rnrGrey-80 rounded-sm overflow-hidden bg-[#0D0D0D] mb-8`}
          >
            {/* File Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-rnrGrey-80 bg-[#141414]">
              <span className="text-xs text-rnrGrey-50 font-mono">
                android/build.gradle
              </span>
              <button className="flex items-center gap-1.5 text-xs text-rnrGrey-50 hover:text-rnrGrey-0 transition-colors group">
                <svg
                  className="w-3.5 h-3.5 group-hover:text-brandSeaBlue-100 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy
              </button>
            </div>

            {/* Code Body */}
            <div className="p-6 overflow-x-auto bg-[#0A0A0A]">
              <pre className="text-sm font-mono leading-loose text-rnrGrey-30">
                <span className="text-rnrGrey-50 italic">
                  // Expo setup requires config plugin
                </span>
                <br />
                <br />
                <span className="text-rnrGrey-0">plugin</span> {'{'}
                <br />
                <span className="block bg-brandSeaBlue-100/5 -mx-6 px-6 border-l-2 border-brandSeaBlue-100">
                  <span className="text-brandSeaBlue-100">{'    '}id</span>{' '}
                  <span className="text-white">"org.rnrepo.expo-plugin"</span>{' '}
                  <span className="text-brandSeaBlue-100">version</span>{' '}
                  <span className="text-white">"1.0.0"</span>
                </span>
                <br />
                {'}'}
              </pre>
            </div>
          </div>
        </div>

        {/* Code Block 2: android/app/build.gradle */}
        <div className="border border-rnrGrey-80 rounded-sm overflow-hidden bg-[#0D0D0D]">
          <div className="flex items-center justify-between px-6 py-3 border-b border-rnrGrey-80 bg-[#141414]">
            <span className="text-xs text-rnrGrey-50 font-mono">
              android/app/build.gradle
            </span>
            <button className="flex items-center gap-1.5 text-xs text-rnrGrey-50 hover:text-rnrGrey-0 transition-colors group">
              <svg
                className="w-3.5 h-3.5 group-hover:text-brandSeaBlue-100 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            </button>
          </div>
          <div className="p-6 overflow-x-auto bg-[#0A0A0A]">
            <pre className="text-sm font-mono leading-loose text-rnrGrey-30">
              <span className="text-rnrGrey-30">apply plugin:</span>{' '}
              <span className="text-white">"com.android.application"</span>
              <br />
              <span className="text-rnrGrey-30">apply plugin:</span>{' '}
              <span className="text-white">"org.jetbrains.kotlin.android"</span>
              <br />
              <span className="text-rnrGrey-30">apply plugin:</span>{' '}
              <span className="text-white">"com.facebook.react"</span>
              <br />
              <span className="block bg-brandSeaBlue-100/5 -mx-6 px-6 border-l-2 border-brandSeaBlue-100 mt-1">
                <span className="text-brandSeaBlue-100">+ apply plugin:</span>{' '}
                <span className="text-white">
                  "org.rnrepo.tools.prebuilds-plugin"
                </span>
              </span>
            </pre>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-8 text-center p-8 bg-surfaceHighlight/20 border border-rnrGrey-80 rounded-sm">
          <h3 className="text-lg font-semibold text-rnrGrey-0 mb-2">
            That's it! Now build your app as usual and enjoy faster builds.
          </h3>
          <p className="text-sm text-rnrGrey-40">
            For detailed instructions, visit our{' '}
            <a
              href="https://github.com"
              className="text-rnrGrey-0 underline hover:text-rnrGrey-30 transition-colors"
            >
              GitHub repository
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
};

export default GettingStarted;
