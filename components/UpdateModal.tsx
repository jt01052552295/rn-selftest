import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface UpdateModalProps {
  visible: boolean;
  required: boolean; // 필수 업데이트 여부
  currentVersion: string;
  latestVersion: string;
  message: string;
  storeAppUrl: string; // 앱 스토어 딥링크
  storeWebUrl: string; // 웹 스토어 URL
  onClose?: () => void;
}

export default function UpdateModal({
  visible,
  required,
  currentVersion,
  latestVersion,
  message,
  storeAppUrl,
  storeWebUrl,
  onClose,
}: UpdateModalProps) {
  const handleUpdate = async () => {
    try {
      // 1. 먼저 앱 스토어 딥링크 시도
      const canOpenApp = await Linking.canOpenURL(storeAppUrl);
      if (canOpenApp) {
        await Linking.openURL(storeAppUrl);
        return;
      }

      // 2. 실패하면 웹 URL로 시도
      if (storeWebUrl) {
        await Linking.openURL(storeWebUrl);
      }
    } catch (error) {
      console.error('스토어 열기 실패:', error);
      Alert.alert(
        '오류',
        '스토어를 열 수 없습니다. 수동으로 업데이트해주세요.',
      );
    }
  };

  const handleLater = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={required ? undefined : handleLater}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* 아이콘 */}
          <View style={styles.iconContainer}>
            <Ionicons name="download-outline" size={60} color="#007AFF" />
          </View>

          {/* 제목 */}
          <Text style={styles.title}>
            {required ? '업데이트 필수' : '업데이트 안내'}
          </Text>

          {/* 버전 정보 */}
          <View style={styles.versionContainer}>
            <Text style={styles.versionLabel}>현재 버전</Text>
            <Text style={styles.versionText}>{currentVersion}</Text>
          </View>
          <Ionicons
            name="arrow-down"
            size={20}
            color="#999"
            style={{ marginVertical: 8 }}
          />
          <View style={styles.versionContainer}>
            <Text style={styles.versionLabel}>최신 버전</Text>
            <Text style={[styles.versionText, { color: '#007AFF' }]}>
              {latestVersion}
            </Text>
          </View>

          {/* 메시지 */}
          <Text style={styles.message}>{message}</Text>

          {/* 버튼 */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.updateButton]}
              onPress={handleUpdate}
            >
              <Text style={styles.updateButtonText}>
                {Platform.OS === 'android'
                  ? 'Play 스토어로 이동'
                  : 'App Store로 이동'}
              </Text>
            </TouchableOpacity>

            {!required && (
              <TouchableOpacity
                style={[styles.button, styles.laterButton]}
                onPress={handleLater}
              >
                <Text style={styles.laterButtonText}>나중에</Text>
              </TouchableOpacity>
            )}
          </View>

          {required && (
            <Text style={styles.requiredNote}>
              * 필수 업데이트입니다. 업데이트 후 이용 가능합니다.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  versionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  versionLabel: {
    fontSize: 14,
    color: '#666',
  },
  versionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  message: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 20,
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  updateButton: {
    backgroundColor: '#007AFF',
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  laterButton: {
    backgroundColor: '#f0f0f0',
  },
  laterButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  requiredNote: {
    fontSize: 12,
    color: '#ff3b30',
    marginTop: 12,
    textAlign: 'center',
  },
});
