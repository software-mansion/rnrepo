import {
  HostComponent,
  requireNativeComponent,
  Text,
  View,
  ViewProps,
} from 'react-native';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';

export interface NativeProps extends ViewProps {
  color?: string;
}

const component = codegenNativeComponent<NativeProps>(
  'MyFrameworkTestView',
) as HostComponent<NativeProps>;

export default component;

// const Component = () => {
//   return <View style={{backgroundColor: 'red', width: 200, height: 200}} />;
// };
// export default Component;

// export default requireNativeComponent('MyFrameworkTestView');
