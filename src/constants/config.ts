import Constants from 'expo-constants';
import { Platform } from 'react-native';


const DEV_URL = Platform.select({
  web: 'http://10.59.165.8:5001/api',
  default: `http://10.59.165.8:5001/api`,
});


// const DEV_URL = Platform.select({
//   web: 'https://worknai-hrms-backend-v-1-0.onrender.com/api',
//   default: `https://worknai-hrms-backend-v-1-0.onrender.com/api`,
// });





export const CONFIG = {
  APP_NAME: 'WorknAI HRMS',
  API_BASE_URL: DEV_URL,
  TIMEOUT: 15000,
};
