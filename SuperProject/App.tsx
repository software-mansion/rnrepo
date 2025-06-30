import React from 'react';
import {Button, Platform, Text, View} from 'react-native';
import IOS from './components/IOS';
import Android from './components/Android';

function App(): React.JSX.Element {
  const handleButtonClick = () => {
    console.log('Button Clicked!');
  };

  return (
    <>
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <Text>Welcome to React Native!</Text>
        <Button title="Test Button" onPress={handleButtonClick} />

        {Platform.OS === 'ios' && <IOS />}
        {Platform.OS === 'android' && <Android />}
      </View>
    </>
  );
}

export default App;
