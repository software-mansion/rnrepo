import React, {useEffect, useState} from 'react';
import {Text} from 'react-native';
import DeviceInfo from 'react-native-device-info';

const ReactNativeDeviceInfoTest = () => {
  const [batteryLevel, setBatteryLevel] = useState<string | undefined>();

  const getBatteryLevel = async () => {
    const bLevel = await DeviceInfo.getApplicationName();
    setBatteryLevel(bLevel);
  };

  useEffect(() => {
    getBatteryLevel();
  }, []);

  return (
    <Text>
      {batteryLevel !== undefined ? batteryLevel : 'Battery level not detected'}
    </Text>
  );
};

export default ReactNativeDeviceInfoTest;
