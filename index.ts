import { registerRootComponent } from 'expo';

import App from './App';
import { initTripStore } from './src/data/tripStore';
import { initSettingsStore } from './src/data/settingsStore';
import { initNotifications } from './src/notifications/notify';
import { initOutlookStore } from './src/data/outlookStore';
import { tryRegisterCarPlay } from './src/carplay';

void initSettingsStore().then(() => Promise.all([initTripStore(), initNotifications(), initOutlookStore()]));
tryRegisterCarPlay();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
