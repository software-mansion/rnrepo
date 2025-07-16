import React, {useEffect, useState} from 'react';
import {PermissionsAndroid, Platform, Text, View} from 'react-native';
import {
  Camera,
  useCameraDevices,
  useLocationPermission,
} from 'react-native-vision-camera';

const ReactNativeVisionCameraTest = () => {
  const [permission, setPermission] = useState<boolean>(false);
  const devices = useCameraDevices();
  const device = devices[1]; // Use the back camera
  const location = useLocationPermission();

  useEffect(() => {
    async function requestPermission() {
      if (Platform.OS === 'android') {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );
        setPermission(result === PermissionsAndroid.RESULTS.GRANTED);
      } else {
        const status = await location.requestPermission();
        setPermission(status);
      }
    }

    requestPermission();
  }, []);

  if (!permission) {
    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <Text>You need to grant camera permission to use this feature.</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <Text>Loading Camera...</Text>
      </View>
    );
  }

  return (
    <Camera
      style={{width: '100%', height: '100%'}}
      device={device}
      isActive={true}
    />
  );
};

export default ReactNativeVisionCameraTest;
