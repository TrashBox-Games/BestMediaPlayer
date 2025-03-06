import { registerRootComponent } from "expo";
import TrackPlayer from "react-native-track-player";

import App from "./App";

// Register the TrackPlayer service
TrackPlayer.registerPlaybackService(() => require('./service.js'));

// Register the main component
registerRootComponent(App);
