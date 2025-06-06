import React, {useState} from 'react';
import {Button, Text, View} from 'react-native';
import MyLocalTestViewNativeComponent from './specs/MyLocalTestViewNativeComponent';
// import TestComponent from './components/TestComponent';
import MyFrameworkTestViewNativeComponent from './specs/MyFrameworkTestViewNativeComponent';
// import MyFrameworkTestViewNativeComponent from './specs/MyFrameworkTestViewNativeComponent';

function App(): React.JSX.Element {
  const [shown, setShown] = useState(false);

  return (
    <>
      <View style={{flex: 1, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 100}}>
        <Text>Welcome to React Native!</Text>
        {shown && <Button onPress={() => setShown(false)} title={'Hide'}/>}
        {!shown && <Button onPress={() => setShown(true)} title={'Show'}/>}
        {shown && <Test />}
      </View>
    </>
  );
}

function Test(): React.JSX.Element {
  return <><Text>Local:</Text>
  <View style={{width: 100, height: 100, backgroundColor: 'navy'}}>
    <MyLocalTestViewNativeComponent
      style={{width: 100, height: 100}}
      color="red"
    />
  </View>
  <Text>Framework:</Text>
  <View style={{width: 100, height: 100, backgroundColor: 'navy'}}>
    <MyFrameworkTestViewNativeComponent
      style={{width: 100, height: 100}}
      color="red"
    />
  </View>
  </>
}

export default App;
