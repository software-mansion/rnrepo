import React, {useEffect} from 'react';
import {Text} from 'react-native';

import {MMKV} from 'react-native-mmkv';

const storage = new MMKV();

const MMKVTest = () => {
  useEffect(() => {
    storage.set('user', 'Marc');
  });

  const username = storage.getString('user');
  return <Text>Username: {username}</Text>;
};

export default MMKVTest;
