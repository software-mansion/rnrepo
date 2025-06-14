import React from 'react';
import Video from './Video';

const ReactNativeVideoTest = () => {
  return (
    <Video
      src={{uri: 'https://www.w3schools.com/html/mov_bbb.mp4'}}
      style={{width: 600, aspectRatio: 16 / 9}}
      controls
    />
  );
};

export default ReactNativeVideoTest;
