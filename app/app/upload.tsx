import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { Button } from "@/components/Button";
import { BlobMascot } from "@/components/BlobMascot";
import { api } from "@/lib/api";

type Picked = { uri: string; name: string; mimeType: string };

export default function UploadScreen() {
  const [file, setFile] = useState<Picked | null>(null);
  const [uploading, setUploading] = useState(false);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "video/mp4", "video/quicktime", "video/x-matroska", "video/webm"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? "application/octet-stream" });
  }

  async function onUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("title", file.name.replace(/\.[^.]+$/, ""));
      // React Native FormData file shape — not the web File API.
      form.append("file", { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
      await api.documents.upload(form);
      router.replace("/(tabs)");
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUploading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.wrap}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[typography.bodyMedium, { color: colors.textMuted }]}>Close</Text>
        </Pressable>

        <View style={{ alignItems: "center", marginTop: 24 }}>
          <BlobMascot color={colors.blue} size={90} mood="excited" />
          <Text style={[typography.h1, { marginTop: 16 }]}>Add a lecture</Text>
          <Text style={[typography.body, { color: colors.textMuted, marginTop: 6, textAlign: "center" }]}>
            Upload a PDF or a recording — we'll turn it into an explainer with quizzes built in.
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

        <Button label={uploading ? "Uploading…" : "Upload"} onPress={onUpload} disabled={!file} loading={uploading} style={{ marginTop: "auto" }} />
      </View>
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
});
