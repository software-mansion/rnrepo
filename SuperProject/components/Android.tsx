import React from 'react';
import {ScrollView} from 'react-native';
import MMKVTest from './android/MMKVTest';
import RNSQLiteTest from './android/RNSQLiteTest';
import ReactNativeVideoTest from './android/ReactNativeVideoTest/ReactNativeVideoTest';
import LocalNativeViewTest from './android/LocalNativeViewTest';
import ReactNativeSVGTest from './android/ReactNativeSVGTest';
import ReactNativeDeviceInfoTest from './android/ReactNativeDeviceInfoTest';
import ReactNativeScreensTest from './android/ReactNativeScreensTest';
import ReactNativeLinearGradientTest from './android/ReactNativeLinearGradientTest';
import ReactNativeClipboardTest from './android/ReactNativeClipboardTest';
import ReactNativeReanimatedTest from './android/ReactNativeReanimatedTest';
import ReactNativeVisionCameraTest from './android/ReactNativeVisionCameraTest';

const Android = () => {
  return (
    <ScrollView
      contentContainerStyle={{
        justifyContent: 'center',
        alignItems: 'center',
      }}
      style={{
        flex: 1,
      }}>
      <LocalNativeViewTest />
      <ReactNativeVideoTest />
      <ReactNativeSVGTest />
      <ReactNativeDeviceInfoTest />
      <MMKVTest />
      <ReactNativeLinearGradientTest />
      <ReactNativeScreensTest />
      <RNSQLiteTest />
      <ReactNativeClipboardTest />
      <ReactNativeReanimatedTest />
      <ReactNativeVisionCameraTest />
    </ScrollView>
  );
};

export default Android;
