import React from 'react';
import {View} from 'react-native';
import MMKVTest from './android/MMKVTest';
import RNSQLiteTest from './android/RNSQLiteTest';
import ReactNativeVideoTest from './android/ReactNativeVideoTest/ReactNativeVideoTest';
import LocalNativeViewTest from './android/LocalNativeViewTest';
import ReactNativeSVGTest from './android/ReactNativeSVGTest';
import ReactNativeDeviceInfoTest from './android/ReactNativeDeviceInfoTest';
import ReactNativeScreensTest from './android/ReactNativeScreensTest';
import Reanimated from 'react-native-reanimated';

const Android = () => {
  // const reaView = Reanimated.createAnimatedComponent(View);
  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      {/* <LocalNativeViewTest />
      <ReactNativeVideoTest /> */}
      {/* <ReactNativeSVGTest /> */}
      {/* <ReactNativeDeviceInfoTest /> */}
      {/* <MMKVTest /> */}
      {/* <ReactNativeScreensTest /> */}
      {/* <RNSQLiteTest /> */}
    </View>
  );
};

export default Android;
