import {HostComponent, ViewProps} from 'react-native';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';

export interface NativeProps extends ViewProps {
  color?: string;
}

const component = codegenNativeComponent<NativeProps>(
  'MyFrameworkTestView',
) as HostComponent<NativeProps>;

export default component;
