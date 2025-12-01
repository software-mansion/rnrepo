import React from 'react';
import { SectionHeader } from './SectionHeader';
import styles from './FAQ.module.css';

const FAQ: React.FC = () => {
  return (
    <section id="faq" className="py-24 border-b border-rnrGrey-80">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <SectionHeader
            title="Frequently Asked Questions"
            subtitle="Everything you need to know about RNRepo."
            className="text-center"
          />
        </div>

        <div className="space-y-4">
          <details className={`${styles.faqItem} border-b border-rnrGrey-80`}>
            <summary className={styles.faqSummary}>
              <span className="font-medium text-rnrGrey-20">
                How do I verify that RNRepo is set up correctly?
              </span>
              <svg
                className={`${styles.faqChevron} w-5 h-5 text-rnrGrey-50`}
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </summary>
            <p
              className={`${styles.faqAnswer} text-rnrGrey-40 text-sm leading-relaxed pr-8 pt-0 pb-4`}
            >
              You can verify the setup by running a standard build and checking
              the Gradle logs. You should see RNRepo plugin tasks executing and
              replacing dependencies with artifacts from our maven repository.
            </p>
          </details>

          <details className={`${styles.faqItem} border-b border-rnrGrey-80`}>
            <summary className={styles.faqSummary}>
              <span className="font-medium text-rnrGrey-20">
                How do I opt out of RNRepo for specific libraries?
              </span>
              <svg
                className={`${styles.faqChevron} w-5 h-5 text-rnrGrey-50`}
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </summary>
            <p
              className={`${styles.faqAnswer} text-rnrGrey-40 text-sm leading-relaxed pr-8 pt-0 pb-4`}
            >
              You can exclude specific libraries in your build.gradle
              configuration block under the rnRepo settings.
            </p>
          </details>

          <details className={`${styles.faqItem} border-b border-rnrGrey-80`}>
            <summary className={styles.faqSummary}>
              <span className="font-medium text-rnrGrey-20">
                What happens if I have local patches for a library?
              </span>
              <svg
                className={`${styles.faqChevron} w-5 h-5 text-rnrGrey-50`}
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </summary>
            <p
              className={`${styles.faqAnswer} text-rnrGrey-40 text-sm leading-relaxed pr-8 pt-0 pb-4`}
            >
              RNRepo respects local patches if configured correctly. Typically,
              if patch-package detects changes, you might need to build that
              specific library from source.
            </p>
          </details>

          <details className={`${styles.faqItem} border-b border-rnrGrey-80`}>
            <summary className={styles.faqSummary}>
              <span className="font-medium text-rnrGrey-20">
                What if a library or React Native version isn't supported?
              </span>
              <svg
                className={`${styles.faqChevron} w-5 h-5 text-rnrGrey-50`}
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </summary>
            <p
              className={`${styles.faqAnswer} text-rnrGrey-40 text-sm leading-relaxed pr-8 pt-0 pb-4`}
            >
              You can request it! Or fall back to standard compilation for that
              specific library. The system is designed to mix and match.
            </p>
          </details>

          <details className={`${styles.faqItem} border-b border-rnrGrey-80`}>
            <summary className={styles.faqSummary}>
              <span className="font-medium text-rnrGrey-20">
                How can I see which libraries are pre-built?
              </span>
              <svg
                className={`${styles.faqChevron} w-5 h-5 text-rnrGrey-50`}
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </summary>
            <p
              className={`${styles.faqAnswer} text-rnrGrey-40 text-sm leading-relaxed pr-8 pt-0 pb-4`}
            >
              Check our libraries.json file in the GitHub repository or browse
              the packages index on our website.
            </p>
          </details>

          <details className={`${styles.faqItem} border-b border-rnrGrey-80`}>
            <summary className={styles.faqSummary}>
              <span className="font-medium text-rnrGrey-20">
                How do I request a new library to be added?
              </span>
              <svg
                className={`${styles.faqChevron} w-5 h-5 text-rnrGrey-50`}
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </summary>
            <p
              className={`${styles.faqAnswer} text-rnrGrey-40 text-sm leading-relaxed pr-8 pt-0 pb-4`}
            >
              Submit an issue or PR to the RNRepo GitHub repository with the
              library details.
            </p>
          </details>

          <details
            className={`${styles.faqItem} border-b border-rnrGrey-80`}
            open
          >
            <summary className={styles.faqSummary}>
              <span className="font-medium text-rnrGrey-20">
                Is RNRepo secure? How can I verify artifacts?
              </span>
              <svg
                className={`${styles.faqChevron} w-5 h-5 text-rnrGrey-50`}
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </summary>
            <p
              className={`${styles.faqAnswer} text-rnrGrey-40 text-sm leading-relaxed pr-8 pt-0 pb-4`}
            >
              Security is a top priority. All builds run in isolated GitHub
              workflows that are fully transparent—you can inspect any build's
              logs and source. Every artifact is GPG-signed, allowing you to
              verify authenticity. When downloading, you can trace any artifact
              back to its exact build workflow.
            </p>
          </details>

          <details className={`${styles.faqItem} border-b border-rnrGrey-80`}>
            <summary className={styles.faqSummary}>
              <span className="font-medium text-rnrGrey-20">
                Do library maintainers need to do anything?
              </span>
              <svg
                className={`${styles.faqChevron} w-5 h-5 text-rnrGrey-50`}
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </summary>
            <p
              className={`${styles.faqAnswer} text-rnrGrey-40 text-sm leading-relaxed pr-8 pt-0 pb-4`}
            >
              No, RNRepo works independently. However, maintainers are welcome
              to collaborate to ensure optimal build configurations.
            </p>
          </details>

          <details className={`${styles.faqItem} border-b border-rnrGrey-80`}>
            <summary className={styles.faqSummary}>
              <span className="font-medium text-rnrGrey-20">
                Can you just pre-build everything?
              </span>
              <svg
                className={`${styles.faqChevron} w-5 h-5 text-rnrGrey-50`}
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </summary>
            <p
              className={`${styles.faqAnswer} text-rnrGrey-40 text-sm leading-relaxed pr-8 pt-0 pb-4`}
            >
              Technically yes, but we focus on the most popular libraries to
              maximize impact and minimize maintenance overhead.
            </p>
          </details>

          <details className={`${styles.faqItem} border-b border-rnrGrey-80`}>
            <summary className={styles.faqSummary}>
              <span className="font-medium text-rnrGrey-20">
                Is iOS supported?
              </span>
              <svg
                className={`${styles.faqChevron} w-5 h-5 text-rnrGrey-50`}
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </summary>
            <p
              className={`${styles.faqAnswer} text-rnrGrey-40 text-sm leading-relaxed pr-8 pt-0 pb-4`}
            >
              Currently, we focus on Android builds as they benefit most from
              pre-compilation. iOS support is being explored.
            </p>
          </details>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
