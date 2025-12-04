export interface FAQItem {
  question: string;
  answer: string;
}

export const faqItems: FAQItem[] = [
  {
    question: 'What if I install RNRepo and run iOS build?',
    answer:
      'In the current version RNRepo only supports Android builds and does not interfere with the way iOS builds are performed. iOS builds will continue to build libraries from source as usual.',
  },
  {
    question: 'How do I verify that RNRepo is set up correctly?',
    answer:
      'Check your Android build logs for entries with the "[📦 RNRepo]" tag. The plugin logs which libraries it detects in your project and specifically lists which ones are being substituted with pre-built artifacts from the repository. If you see these logs during your build, RNRepo is working correctly.',
  },
  {
    question: 'How do I opt out of RNRepo for specific libraries?',
    answer:
      'You can opt out globally by setting the DISABLE_RNREPO environment variable. For granular control, you can exclude specific libraries using the JSON configuration file. This allows you to continue using RNRepo for most libraries while building specific ones from source when needed.',
  },
  {
    question: 'What happens if I have local patches for a library?',
    answer:
      "If your patches modify native code (Objective-C, Java, or Kotlin), you'll need to add that library to the opt-out list so it builds from your patched source. JavaScript-only patches don't require opting out since they don't affect the native build artifacts.",
  },
  {
    question: "What if a library or React Native version isn't supported?",
    answer:
      "RNRepo has a transparent fallback mechanism. If a specific version isn't available in our repository, the build will automatically fall back to compiling from source—just like before RNRepo. Your builds won't fail; they'll just take longer for unsupported libraries.",
  },
  {
    question: 'Which React Native versions are supported?',
    answer:
      'We support all React Native versions 0.80.0 and above, plus the latest patch versions for 0.77.3, 0.78.3, and 0.79.9. If your React Native version is not supported, prebuilt artifacts will automatically fall back to building from source. For a complete list of all supported versions, refer to the react-native-versions.json file in <a href="https://github.com/software-mansion/rnrepo" class="text-rnrGrey-0 underline hover:text-rnrGrey-30 transition-colors">Our GitHub repository</a>.',
  },
  {
    question: 'How can I see which libraries are pre-built?',
    answer:
      'The complete list of supported libraries is maintained in the libraries.json file in our GitHub repository. This file contains all library names and the React Native versions we build against. Check <a href="https://github.com/software-mansion/rnrepo" class="text-rnrGrey-0 underline hover:text-rnrGrey-30 transition-colors">Our GitHub repository</a> for the current list.',
  },
  {
    question: 'How do I request a new library to be added?',
    answer:
      "Currently, library additions are a manual process. If you'd like a library added to RNRepo, please open an issue on our GitHub repository. We prioritize libraries based on community demand and compatibility with our build system.",
  },
  {
    question: 'Is RNRepo secure? How can I verify artifacts?',
    answer:
      "Security is a top priority. All builds run in isolated GitHub workflows that are fully transparent — you can inspect any build's logs and source. Every artifact is GPG-signed, allowing you to verify authenticity. When downloading, you can trace any artifact back to its exact build workflow.",
  },
  {
    question: 'Do library maintainers need to do anything?',
    answer:
      "No! RNRepo doesn't require any action from library maintainers. We build and publish libraries using our own GitHub Action workflows, pulling source code from the official repositories. It's completely transparent to library authors.",
  },
  {
    question: 'Can you just pre-build everything?',
    answer:
      "Unfortunately, not all libraries can be pre-built. Some libraries have build-time flags or link via C++ headers with other libraries. In these cases, the build is tied to a specific app's environment and cannot be published as a universal pre-built package. These libraries will automatically fall back to building from source.",
  },
  {
    question: 'Is iOS supported?',
    answer:
      'iOS support is currently in development. We\'re actively working on bringing the same build speed improvements to iOS. Follow <a href="https://x.com/swmansion" target="_blank" rel="noopener noreferrer" class="text-brandSeaBlue-100 hover:underline">Software Mansion on X</a> to stay updated on our progress and be the first to know when iOS support launches.',
  },
];
