/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

console.log('Log');

AppRegistry.registerComponent(appName, () => App);
