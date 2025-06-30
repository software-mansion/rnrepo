import React from 'react';
import {Text, View} from 'react-native';
import {useSharedValue} from 'react-native-reanimated';

const ReactNativeReanimatedTest = () => {
  const testSharedValue = useSharedValue(0);
  return (
    <View>
      <Text>React Native Reanimated Test!</Text>
    </View>
  );
};

export default ReactNativeReanimatedTest;
