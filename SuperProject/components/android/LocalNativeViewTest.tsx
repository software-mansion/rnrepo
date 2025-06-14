import React, {useEffect} from 'react';
import {View} from 'react-native';
import MyLocalTestViewNativeComponent from '../../specs/MyLocalTestViewNativeComponent';

const LocalNativeViewTest = () => {
  return (
    <View style={{width: 100, height: 100, backgroundColor: 'navy'}}>
      <MyLocalTestViewNativeComponent
        style={{width: 100, height: 200}}
        color="green"
      />
    </View>
  );
};

export default LocalNativeViewTest;
