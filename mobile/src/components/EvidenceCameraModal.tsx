import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/AppButton';
import { Notice } from '@/components/Notice';
import { colors, spacing, typography } from '@/theme';

interface EvidenceCameraModalProps {
  visible: boolean;
  onClose: () => void;
  onCapture: (uri: string) => void;
}

export function EvidenceCameraModal({
  visible,
  onClose,
  onCapture,
}: EvidenceCameraModalProps) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = async () => {
    setError(null);
    setIsCapturing(true);

    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
      if (!photo?.uri) {
        setError('No pudimos tomar la foto. Intenta de nuevo.');
        return;
      }
      onCapture(photo.uri);
    } catch {
      setError('No pudimos tomar la foto. Intenta de nuevo.');
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Foto de evidencia</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar cámara"
            onPress={onClose}
            style={styles.closeButton}
          >
            <Text style={styles.closeText}>Cerrar</Text>
          </Pressable>
        </View>

        {permission?.granted ? (
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        ) : (
          <View style={styles.permission}>
            <Text style={styles.permissionTitle}>Necesitamos acceso a la cámara</Text>
            <Text style={styles.permissionText}>
              La foto es obligatoria para confirmar la entrega o recogida.
            </Text>
            <AppButton title="Permitir cámara" onPress={() => void requestPermission()} />
          </View>
        )}

        {error ? <Notice message={error} /> : null}

        {permission?.granted ? (
          <View style={styles.actions}>
            <AppButton
              title={isCapturing ? 'Tomando foto...' : 'Tomar foto y continuar'}
              loading={isCapturing}
              onPress={() => void handleCapture()}
            />
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  closeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  closeText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '700',
  },
  camera: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  permission: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  permissionTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
    textAlign: 'center',
  },
  permissionText: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 24,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.sm,
  },
});
