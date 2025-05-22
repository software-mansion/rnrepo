import type { HostComponent, ViewProps } from 'react-native';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';

export interface NativeProps extends ViewProps {
  color?: string;
}

export default codegenNativeComponent<NativeProps>(
  'MyFrameworkTestView'
) as HostComponent<NativeProps>;
