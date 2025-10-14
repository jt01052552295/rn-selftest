import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getUniqueDeviceId() {
  const KEY = 'selftest_device_id';
  const saved = await AsyncStorage.getItem(KEY);
  if (saved) return saved;
  const id = 'device-' + Math.random().toString(36).slice(2, 10);
  await AsyncStorage.setItem(KEY, id);
  return id;
}
