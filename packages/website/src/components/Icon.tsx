import React from 'react';

interface IconProps {
  name: string;
  className?: string;
}

// Import SVGs as raw text at build time
import speedSvg from '../assets/icons/speed.svg?raw';
import openSourceSvg from '../assets/icons/open-source.svg?raw';
import shieldSvg from '../assets/icons/shield.svg?raw';
import boxSvg from '../assets/icons/box.svg?raw';
import phoneSvg from '../assets/icons/phone.svg?raw';
import folderSvg from '../assets/icons/folder.svg?raw';
import checkSvg from '../assets/icons/check.svg?raw';
import clockSvg from '../assets/icons/clock.svg?raw';
import serverSvg from '../assets/icons/server.svg?raw';
import chevronDownSvg from '../assets/icons/chevron-down.svg?raw';
import githubSvg from '../assets/icons/github.svg?raw';
import xSvg from '../assets/icons/x.svg?raw';
import youtubeSvg from '../assets/icons/youtube.svg?raw';
import gitBranchSvg from '../assets/icons/git-branch.svg?raw';
import buildingSvg from '../assets/icons/building.svg?raw';
import lockSvg from '../assets/icons/lock.svg?raw';
import fileTextSvg from '../assets/icons/file-text.svg?raw';
import arrowDownSvg from '../assets/icons/arrow-down.svg?raw';

const svgMap: Record<string, string> = {
  speed: speedSvg,
  'open-source': openSourceSvg,
  shield: shieldSvg,
  box: boxSvg,
  phone: phoneSvg,
  folder: folderSvg,
  check: checkSvg,
  clock: clockSvg,
  server: serverSvg,
  'chevron-down': chevronDownSvg,
  github: githubSvg,
  x: xSvg,
  youtube: youtubeSvg,
  'git-branch': gitBranchSvg,
  building: buildingSvg,
  lock: lockSvg,
  'file-text': fileTextSvg,
  'arrow-down': arrowDownSvg,
};

export const Icon: React.FC<IconProps> = ({ name, className = '' }) => {
  const svgContent = svgMap[name];

  if (!svgContent) {
    console.warn(`Icon not found: ${name}`);
    return null;
  }

  // Extract the inner content and attributes
  const svgTagMatch = svgContent.match(/<svg([^>]*)>/);
  const innerMatch = svgContent.match(/<svg[^>]*>(.*?)<\/svg>/s);

  if (!svgTagMatch || !innerMatch) {
    console.error(`Invalid SVG format for icon: ${name}`);
    return null;
  }

  const attrs = svgTagMatch[1];
  const innerContent = innerMatch[1];

  // Create new SVG with className support for styling
  const newSvg = `<svg${attrs} class="${className}">${innerContent}</svg>`;

  return <span dangerouslySetInnerHTML={{ __html: newSvg }} />;
};
