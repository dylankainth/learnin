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
  const [files, setFiles] = useState<Picked[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
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

  async function pickFiles() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "video/mp4", "video/quicktime", "video/x-matroska", "video/webm"],
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const picked = result.assets.map((asset) => ({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? "application/octet-stream",
    }));
    // A picker round-trip can return the same file twice (e.g. picking again
    // without clearing); de-dupe by uri so it doesn't queue an upload twice.
    setFiles((prev) => {
      const existingUris = new Set(prev.map((f) => f.uri));
      return [...prev, ...picked.filter((f) => !existingUris.has(f.uri))];
    });
  }

  function removeFile(uri: string) {
    setFiles((prev) => prev.filter((f) => f.uri !== uri));
  }

  async function doUpload(integrationMode: IntegrationMode) {
    if (files.length === 0) return;
    setUploading(true);
    setUploadProgress({ done: 0, total: files.length });
    const failures: { name: string; message: string }[] = [];
    const succeededUris = new Set<string>();

    // Uploaded one at a time, in order: each enqueues a background ingest
    // job, and for "arrange" mode the server reads the topic's current
    // blocks to decide where new content fits — running them concurrently
    // would let two uploads read the same "before" snapshot and both try to
    // arrange into the same spot.
    for (const file of files) {
      try {
        const form = new FormData();
        form.append("title", file.name.replace(/\.[^.]+$/, ""));
        form.append("topic_id", topicId);
        form.append("integration_mode", integrationMode);
        form.append("file", { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
        await api.documents.upload(form);
        succeededUris.add(file.uri);
      } catch (err) {
        failures.push({ name: file.name, message: err instanceof Error ? err.message : "Something went wrong" });
      }
      setUploadProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    setUploading(false);
    setFiles((prev) => prev.filter((f) => !succeededUris.has(f.uri)));

    if (failures.length === 0) {
      router.replace(`/topic/${topicId}`);
      return;
    }
    const failedList = failures.map((f) => `${f.name}: ${f.message}`).join("\n");
    if (succeededUris.size > 0) {
      Alert.alert(
        "Some uploads failed",
        `${succeededUris.size} of ${files.length} uploaded. The rest are still in the list to retry:\n\n${failedList}`,
      );
    } else {
      Alert.alert("Upload failed", failedList);
    }
  }

  async function onUpload() {
    if (files.length === 0) {
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
            Upload PDFs or videos to build interactive study cards. You can pick more than one at a time.
          </Text>
        </View>

        <Pressable style={styles.dropzone} onPress={pickFiles}>
          <Text style={typography.bodyMedium}>{files.length > 0 ? "Add more files" : "Tap to choose files"}</Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>PDF, MP4, MOV, MKV, WebM</Text>
        </Pressable>

        {files.length > 0 && (
          <View style={{ marginTop: 16, gap: 8 }}>
            {files.map((f) => (
              <View key={f.uri} style={styles.fileRow}>
                <Text style={[typography.body, { flex: 1 }]} numberOfLines={1}>
                  {f.name}
                </Text>
                {!uploading && (
                  <Pressable onPress={() => removeFile(f.uri)} hitSlop={10}>
                    <Text style={{ color: colors.textMuted, fontSize: 18, lineHeight: 18 }}>×</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}

        {uploading && (
          <Text style={[typography.caption, { color: colors.textMuted, textAlign: "center", marginTop: 16 }]}>
            Uploading {Math.min(uploadProgress.done + 1, uploadProgress.total)} of {uploadProgress.total}…
          </Text>
        )}

        <Button
          label={files.length > 1 ? `Upload ${files.length} files` : "Upload"}
          onPress={onUpload}
          disabled={files.length === 0}
          loading={uploading}
          style={{ marginTop: uploading ? 12 : 32 }}
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
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
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
