import React from 'react';
import { Svg, Circle, Rect, Path, G } from 'react-native-svg';

interface SvgIconProps {
  size?: number;
  color?: string;
  testID?: string;
}

export const CircleIcon: React.FC<SvgIconProps> = ({ 
  size = 24, 
  color = '#000', 
  testID = 'circle-icon' 
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" testID={testID}>
    <Circle cx="12" cy="12" r="10" fill={color} />
  </Svg>
);

export const RectIcon: React.FC<SvgIconProps> = ({ 
  size = 24, 
  color = '#000', 
  testID = 'rect-icon' 
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" testID={testID}>
    <Rect x="4" y="6" width="16" height="12" rx="2" fill={color} />
  </Svg>
);

export const HeartIcon: React.FC<SvgIconProps> = ({ 
  size = 24, 
  color = '#000', 
  testID = 'heart-icon' 
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" testID={testID}>
    <Path
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
      fill={color}
    />
  </Svg>
);

export const ComplexIcon: React.FC<SvgIconProps> = ({ 
  size = 24, 
  color = '#000', 
  testID = 'complex-icon' 
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" testID={testID}>
    <G>
      <Circle cx="12" cy="12" r="8" fill={color} opacity="0.2" />
      <Rect x="8" y="8" width="8" height="8" rx="1" fill={color} />
      <Path d="M12 2 L20 12 L12 22 L4 12 Z" fill="none" stroke={color} strokeWidth="2" />
    </G>
  </Svg>
);