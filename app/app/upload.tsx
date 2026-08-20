import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { router, useLocalSearchParams } from "expo-router";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { Button } from "@/components/Button";
import { BlobMascot } from "@/components/BlobMascot";
import { api } from "@/lib/api";

type Picked = { uri: string; name: string; mimeType: string };
type IntegrationMode = "append" | "arrange";

export default function UploadScreen() {
  const { topicId, hasContent } = useLocalSearchParams<{ topicId: string; hasContent?: string }>();
  const topicHasContent = hasContent === "true";
  const [file, setFile] = useState<Picked | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showModeModal, setShowModeModal] = useState(false);

  if (!topicId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 }}>
          <Text style={[typography.body, { color: colors.textMuted }]}>Invalid topic</Text>
          <Button label="Go Back" onPress={() => router.back()} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "video/mp4", "video/quicktime", "video/x-matroska", "video/webm"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? "application/octet-stream" });
  }

  async function doUpload(integrationMode: IntegrationMode) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("title", file.name.replace(/\.[^.]+$/, ""));
      form.append("topic_id", topicId);
      form.append("integration_mode", integrationMode);
      form.append("file", { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
      await api.documents.upload(form);
      router.replace(`/topic/${topicId}`);
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUploading(false);
    }
  }

  async function onUpload() {
    if (!file) {
      Alert.alert("Please select a file");
      return;
    }
    if (topicHasContent) {
      setShowModeModal(true);
    } else {
      await doUpload("append");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={styles.wrap} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[typography.bodyMedium, { color: colors.textMuted }]}>Close</Text>
        </Pressable>

        <View style={{ alignItems: "center", marginTop: 24 }}>
          <BlobMascot color={colors.blue} size={90} mood="excited" />
          <Text style={[typography.h1, { marginTop: 16 }]}>Add to topic</Text>
          <Text style={[typography.body, { color: colors.textMuted, marginTop: 6, textAlign: "center" }]}>
            Upload a PDF or video to build interactive study cards.
          </Text>
        </View>

        <Pressable style={styles.dropzone} onPress={pickFile}>
          {file ? (
            <Text style={typography.bodyMedium} numberOfLines={2}>
              {file.name}
            </Text>
          ) : (
            <>
              <Text style={typography.bodyMedium}>Tap to choose a file</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>PDF, MP4, MOV, MKV, WebM</Text>
            </>
          )}
        </Pressable>

        <Button
          label={uploading ? "Uploading…" : "Upload"}
          onPress={onUpload}
          disabled={!file}
          loading={uploading}
          style={{ marginTop: 32 }}
        />
      </ScrollView>

      <Modal visible={showModeModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[typography.h2, { marginBottom: 8 }]}>How should we add this?</Text>
            <Text style={[typography.body, { color: colors.textMuted, marginBottom: 24 }]}>
              This topic already has study content. Choose how to integrate the new material.
            </Text>

            <Pressable style={styles.modeOption} onPress={() => { setShowModeModal(false); doUpload("arrange"); }}>
              <Text style={typography.bodyMedium}>AI arrange for best flow</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                The AI will weave new content into the most logical position, keeping locked sections in place.
              </Text>
            </Pressable>

            <View style={{ height: 12 }} />

            <Pressable style={styles.modeOption} onPress={() => { setShowModeModal(false); doUpload("append"); }}>
              <Text style={typography.bodyMedium}>Append to end</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                New content is added after everything already in this topic.
              </Text>
            </Pressable>

            <Pressable style={{ marginTop: 20, alignItems: "center" }} onPress={() => setShowModeModal(false)}>
              <Text style={[typography.body, { color: colors.textMuted }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  dropzone: {
    marginTop: 32,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: 36,
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: 24,
    paddingBottom: 40,
  },
  modeOption: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
