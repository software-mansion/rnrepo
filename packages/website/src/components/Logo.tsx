import React from 'react';
import rnrepoLogoSvg from '../assets/images/rnrepo-logo.svg?raw';
import swmLogoSvg from '../assets/images/swm-logo.svg?raw';

interface LogoProps {
  name: 'rnrepo' | 'swm';
  className?: string;
  alt?: string;
}

export const Logo: React.FC<LogoProps> = ({ name, className = '', alt }) => {
  const svgContent = name === 'rnrepo' ? rnrepoLogoSvg : swmLogoSvg;
  const defaultAlt = name === 'rnrepo' ? 'RNRepo' : 'Software Mansion';

  if (!svgContent) {
    return null;
  }

  // Extract the inner content and attributes
  const svgTagMatch = svgContent.match(/<svg([^>]*)>/);
  const innerMatch = svgContent.match(/<svg[^>]*>(.*?)<\/svg>/s);

  if (!svgTagMatch || !innerMatch) {
    console.error(`Invalid SVG format for logo: ${name}`);
    return null;
  }

  const attrs = svgTagMatch[1];
  const innerContent = innerMatch[1];

  // Create new SVG with className support for styling
  // For logos, we want to preserve the original attributes but add className
  const newSvg = `<svg${attrs} class="${className}">${innerContent}</svg>`;

  return <span dangerouslySetInnerHTML={{ __html: newSvg }} />;
};
