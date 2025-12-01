import React, { useState } from 'react';
import { SectionHeader } from './SectionHeader';
import { Icon } from './Icon';

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
          <FAQItem
            question="How do I verify that RNRepo is set up correctly?"
            answer="You can verify the setup by running a standard build and checking the Gradle logs. You should see RNRepo plugin tasks executing and replacing dependencies with artifacts from our maven repository."
          />
          <FAQItem
            question="How do I opt out of RNRepo for specific libraries?"
            answer="You can exclude specific libraries in your build.gradle configuration block under the rnRepo settings."
          />
          <FAQItem
            question="What happens if I have local patches for a library?"
            answer="RNRepo respects local patches if configured correctly. Typically, if patch-package detects changes, you might need to build that specific library from source."
          />
          <FAQItem
            question="What if a library or React Native version isn't supported?"
            answer="You can request it! Or fall back to standard compilation for that specific library. The system is designed to mix and match."
          />
          <FAQItem
            question="How can I see which libraries are pre-built?"
            answer="Check our libraries.json file in the GitHub repository or browse the packages index on our website."
          />
          <FAQItem
            question="How do I request a new library to be added?"
            answer="Submit an issue or PR to the RNRepo GitHub repository with the library details."
          />
          <FAQItem
            question="Is RNRepo secure? How can I verify artifacts?"
            answer="Security is a top priority. All builds run in isolated GitHub workflows that are fully transparent—you can inspect any build's logs and source. Every artifact is GPG-signed, allowing you to verify authenticity. When downloading, you can trace any artifact back to its exact build workflow."
            isOpen={true}
          />
          <FAQItem
            question="Do library maintainers need to do anything?"
            answer="No, RNRepo works independently. However, maintainers are welcome to collaborate to ensure optimal build configurations."
          />
          <FAQItem
            question="Can you just pre-build everything?"
            answer="Technically yes, but we focus on the most popular libraries to maximize impact and minimize maintenance overhead."
          />
          <FAQItem
            question="Is iOS supported?"
            answer="Currently, we focus on Android builds as they benefit most from pre-compilation. iOS support is being explored."
          />
        </div>
      </div>
    </section>
  );
};

const FAQItem: React.FC<{
  question: string;
  answer: string;
  isOpen?: boolean;
}> = ({ question, answer, isOpen = false }) => {
  const [open, setOpen] = useState(isOpen);

  return (
    <div className="border-b border-rnrGrey-80">
      <button
        onClick={() => setOpen(!open)}
        className="w-full py-4 flex items-center justify-between text-left hover:text-brandSeaBlue-100 transition-colors focus:outline-none"
      >
        <span className="font-medium text-rnrGrey-20">{question}</span>
        <span
          className={`transform transition-transform duration-200 ${
            open ? 'rotate-180 text-brandSeaBlue-100' : 'text-rnrGrey-50'
          }`}
        >
          <Icon name="chevron-down" className="w-5 h-5" />
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? 'max-h-96 opacity-100 pb-4' : 'max-h-0 opacity-0'
        }`}
      >
        <p className="text-rnrGrey-40 text-sm leading-relaxed pr-8">{answer}</p>
      </div>
    </div>
  );
};

export default FAQ;
