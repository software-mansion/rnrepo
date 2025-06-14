import React from 'react';
import {View} from 'react-native';
import MMKVTest from './android/MMKVTest';
import RNSQLiteTest from './android/RNSQLiteTest';
import ReactNativeVideoTest from './android/ReactNativeVideoTest/ReactNativeVideoTest';
import LocalNativeViewTest from './android/LocalNativeViewTest';
import ReactNativeSVGTest from './android/ReactNativeSVGTest';
import ReactNativeDeviceInfoTest from './android/ReactNativeDeviceInfoTest';
import ReactNativeScreensTest from './android/ReactNativeScreensTest';

const Android = () => {
  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <LocalNativeViewTest />
      <ReactNativeVideoTest />
      {/* <ReactNativeSVGTest /> */}
      <ReactNativeDeviceInfoTest />
      {/* <MMKVTest /> */}
      <ReactNativeScreensTest />
      <RNSQLiteTest />
    </View>
  );
};

export default Android;
