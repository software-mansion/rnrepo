import Clipboard from '@react-native-clipboard/clipboard';
import React, {useState} from 'react';
import {Text, TouchableOpacity, View} from 'react-native';

const ReactNativeClipboardTest = () => {
  const [copiedText, setCopiedText] = useState('');

  const copyToClipboard = () => {
    Clipboard.setString('hello world');
  };

  const fetchCopiedText = async () => {
    const text = await Clipboard.getString();
    setCopiedText(text);
  };

  const pressHandler = async () => {
    copyToClipboard();
    fetchCopiedText();
  };

  return (
    <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
      <TouchableOpacity
        onPress={pressHandler}
        style={{width: 100, height: 100, backgroundColor: 'red'}}
      />
      <Text>Copied Text: {copiedText}</Text>
    </View>
  );
};

export default ReactNativeClipboardTest;
