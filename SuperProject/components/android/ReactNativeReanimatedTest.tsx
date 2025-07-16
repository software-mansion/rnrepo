import React, {useEffect} from 'react';
import {Text, View, StyleSheet, Button} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const ReactNativeReanimatedTest = () => {
  const testSharedValue = useSharedValue(0);

  // Animated style using the shared value
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: testSharedValue.value,
      transform: [{scale: testSharedValue.value}],
    };
  });

  useEffect(() => {
    // Log the current value
    console.log('THE VALUE IS:', testSharedValue.value);
  }, []);

  // Function to initiate animation
  const animateValue = () => {
    // Using withTiming for animation of the shared value
    testSharedValue.value = withTiming(
      1,
      {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      },
      () => {
        // Optionally, reverse the animation after completion
        testSharedValue.value = withTiming(0, {
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
        });
      },
    );
  };

  return (
    <View style={styles.container}>
      <Text>React Native Reanimated Test!</Text>
      <Reanimated.View style={[styles.box, animatedStyle]}>
        <Text>Animated Box!</Text>
      </Reanimated.View>
      <Button title="Animate!" onPress={animateValue} />
    </View>
  );
};

// Styles for the components
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    width: 100,
    height: 100,
    backgroundColor: 'blue',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 20,
  },
});

export default ReactNativeReanimatedTest;
