import React, {useEffect, useState} from 'react';
import {Button, Text, View} from 'react-native';
import {Screen, screensEnabled, ScreenStack} from 'react-native-screens';


const ReactNativeScreensTest = () => {
  const [activeScreen, setActiveScreen] = useState('Home');

  const navigate = (screenName: string) => {
    setActiveScreen(screenName);
  };

  useEffect(() => {
    console.log(
      `RN SCREENS LIBRARY IS: ${screensEnabled() ? 'ENABLED' : 'DISABLED'}`,
    );
  }, []);
  return (
    <View
      style={{
        borderColor: 'red',
        borderWidth: 5,
        width: 200,
        height: 200,
      }}>
      <ScreenStack style={{flex: 1}}>
        {activeScreen === 'Home' && (
          <Screen style={{backgroundColor: 'green'}}>
            <View
              style={{
                // flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderColor: 'red',
                borderWidth: 5,
              }}>
              <Text>Home Screen</Text>
              <Button
                title="Go to Details"
                onPress={() => {
                  navigate('Details');
                }}
              />
            </View>
          </Screen>
        )}

        {activeScreen === 'Details' && (
          <Screen>
            <View
              style={{
                // flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderColor: 'green',
                borderWidth: 5,
              }}>
              <Text>Details Screen</Text>
              <Button
                title="Go to Home"
                onPress={() => {
                  navigate('Home');
                }}
              />
            </View>
          </Screen>
        )}
      </ScreenStack>
    </View>
  );
};

export default ReactNativeScreensTest;
