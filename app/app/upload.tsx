import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, Modal, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { router, useLocalSearchParams } from "expo-router";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { Button } from "@/components/Button";
import { BlobMascot } from "@/components/BlobMascot";
import { api } from "@/lib/api";
import type { Topic } from "@/lib/types";

type Picked = { uri: string; name: string; mimeType: string };

export default function UploadScreen() {
  const { topicId } = useLocalSearchParams<{ topicId?: string }>();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(topicId ?? null);
  const [showNewTopicModal, setShowNewTopicModal] = useState(false);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTopicDesc, setNewTopicDesc] = useState("");
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [file, setFile] = useState<Picked | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.topics.list().then((res) => setTopics(res.topics)).catch(() => {});
  }, []);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "video/mp4", "video/quicktime", "video/x-matroska", "video/webm"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? "application/octet-stream" });
  }

  async function createNewTopic() {
    if (!newTopicName.trim()) {
      Alert.alert("Topic name required");
      return;
    }
    setCreatingTopic(true);
    try {
      const res = await api.topics.create(newTopicName, newTopicDesc || undefined);
      setTopics([...topics, res.topic]);
      setSelectedTopic(res.topic.id);
      setNewTopicName("");
      setNewTopicDesc("");
      setShowNewTopicModal(false);
    } catch (err) {
      Alert.alert("Failed to create topic", err instanceof Error ? err.message : "");
    } finally {
      setCreatingTopic(false);
    }
  }

  async function onUpload() {
    if (!file || !selectedTopic) {
      Alert.alert("Please select a topic first");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("title", file.name.replace(/\.[^.]+$/, ""));
      form.append("topic_id", selectedTopic);
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
      <ScrollView style={styles.wrap} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[typography.bodyMedium, { color: colors.textMuted }]}>Close</Text>
        </Pressable>

        <View style={{ alignItems: "center", marginTop: 24 }}>
          <BlobMascot color={colors.blue} size={90} mood="excited" />
          <Text style={[typography.h1, { marginTop: 16 }]}>Add to a topic</Text>
          <Text style={[typography.body, { color: colors.textMuted, marginTop: 6, textAlign: "center" }]}>
            Choose or create a topic, then upload a file to build quizzes.
          </Text>
        </View>

        <View style={{ marginTop: 32, gap: 12 }}>
          <Text style={[typography.caption, { color: colors.textMuted }]}>SELECT OR CREATE TOPIC</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ gap: 8 }}>
            {topics.map((t) => (
              <Pressable
                key={t.id}
                style={[styles.topicButton, selectedTopic === t.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setSelectedTopic(t.id)}
              >
                <Text style={[typography.bodyMedium, selectedTopic === t.id && { color: "#fff" }]}>{t.name}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.newTopicButton} onPress={() => setShowNewTopicModal(true)}>
              <Text style={[typography.bodyMedium, { color: colors.primary }]}>+ New</Text>
            </Pressable>
          </ScrollView>

          {selectedTopic && (
            <Text style={[typography.caption, { color: colors.success }]}>✓ Topic selected</Text>
          )}
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
          disabled={!file || !selectedTopic}
          loading={uploading}
          style={{ marginTop: 32 }}
        />
      </ScrollView>

      <Modal visible={showNewTopicModal} transparent animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={styles.modalContent}>
            <View style={{ gap: 16 }}>
              <Text style={typography.h2}>Create new topic</Text>
              <TextInput
                placeholder="Topic name"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={newTopicName}
                onChangeText={setNewTopicName}
              />
              <TextInput
                placeholder="Description (optional)"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { height: 60 }]}
                multiline
                value={newTopicDesc}
                onChangeText={setNewTopicDesc}
              />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Pressable
                  style={[styles.modalButton, { backgroundColor: colors.surfaceMuted, flex: 1 }]}
                  onPress={() => {
                    setShowNewTopicModal(false);
                    setNewTopicName("");
                    setNewTopicDesc("");
                  }}
                >
                  <Text style={[typography.button, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, { backgroundColor: colors.primary, flex: 1 }]}
                  onPress={createNewTopic}
                  disabled={creatingTopic}
                >
                  <Text style={[typography.button, { color: "#fff" }]}>
                    {creatingTopic ? "Creating…" : "Create"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  topicButton: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  newTopicButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 4,
  },
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
  modalContent: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: 24,
    justifyContent: "flex-end",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  modalButton: {
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
});
