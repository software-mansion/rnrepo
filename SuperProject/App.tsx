import React, {useRef} from 'react';
import {Button, Text, View, ViewComponent} from 'react-native';
import MyLocalTestViewNativeComponent from './specs/MyLocalTestViewNativeComponent';
import TestComponent from './components/TestComponent';
// import MyFrameworkTestViewNativeComponent from './specs/MyFrameworkTestViewNativeComponent';

function App(): React.JSX.Element {
  const myRef = useRef(null);
  const handleLog = () => {
    console.log(myRef.current._viewConfig);
  };

  return (
    <>
      <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
        <Text>Welcome to React Native!</Text>
        <Button title="Log Message" onPress={handleLog} />
        <View style={{width: 100, height: 100, backgroundColor: 'navy'}}>
          {/* <MyLocalTestViewNativeComponent
            style={{width: 200, height: 200}}
            color="red"
            ref={myRef}
          /> */}
          {/* <MyFrameworkTestViewNativeComponent
            style={{width: 200, height: 200}}
            color="red"
            ref={myRef}
          /> */}
          <TestComponent
            style={{width: 200, height: 200}}
            color="red"
            ref={myRef}
          />
        </View>
      </View>
    </>
  );
}

export default App;
