import React from 'react';
import {
  requireNativeComponent,
  UIManager,
  Platform,
  ViewStyle,
  NativeSyntheticEvent,
  StyleProp,
} from 'react-native';

const COMPONENT_NAME = 'RCTVideo';

// Check if component exists
const VideoComponent = requireNativeComponent(COMPONENT_NAME);

type VideoProps = {
  src: {
    uri: string;
    type?: string;
  };
  style?: StyleProp<ViewStyle>;
  resizeMode?: 'none' | 'contain' | 'cover' | 'stretch';
  repeat?: boolean;
  paused?: boolean;
  muted?: boolean;
  controls?: boolean;
  onEnd?: () => void;
  onError?: (event: NativeSyntheticEvent<any>) => void;
};

const Video: React.FC<VideoProps> = props => {
  return <VideoComponent {...props} />;
};

export default Video;
