import React from 'react';

import Svg, {Rect} from 'react-native-svg';


const ReactNativeSVGTest = () => {
  return (
    <Svg width="100" height="100">
      <Rect
        x="20"
        y="20"
        width="75"
        height="75"
        fill="blue"
        fillOpacity="0.5"
        stroke="red"
        strokeWidth="5"
        strokeOpacity="0.5"
      />
    </Svg>
  );
};

export default ReactNativeSVGTest;
