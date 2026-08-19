import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, TextInput, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { BlobMascot } from "@/components/BlobMascot";
import { Button } from "@/components/Button";
import { api } from "@/lib/api";

export default function CreateTopicScreen() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      Alert.alert("Topic name required");
      return;
    }
    setLoading(true);
    try {
      const res = await api.topics.create(name, description || undefined);
      // Use push with proper reset instead of replace
      router.push(`/topic/${res.topic.id}`);
      setLoading(false);
    } catch (err) {
      Alert.alert("Failed to create topic", err instanceof Error ? err.message : "");
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false} scrollEventThrottle={16}>
        {/* Header with illustration */}
        <View style={styles.header}>
          <BlobMascot color={colors.primary} size={100} mood="excited" />
          <Text style={[typography.h1, { marginTop: 18, textAlign: "center" }]}>Start a New Topic</Text>
          <Text style={[typography.body, { color: colors.textMuted, marginTop: 6, textAlign: "center", fontSize: 14 }]}>
            Organize your learning around a specific subject. Add PDFs, videos, or documents.
          </Text>
        </View>

        {/* Info cards */}
        <View style={styles.infoCards}>
          <View style={[styles.infoCard, { borderLeftColor: colors.success }]}>
            <Text style={styles.infoIcon}>📚</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[typography.caption, { color: colors.textMuted, fontWeight: "600" }]}>Add Content</Text>
              <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11, marginTop: 2 }]}>
                Upload PDFs, videos, or documents
              </Text>
            </View>
          </View>

          <View style={[styles.infoCard, { borderLeftColor: colors.blue }]}>
            <Text style={styles.infoIcon}>✨</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[typography.caption, { color: colors.textMuted, fontWeight: "600" }]}>Auto-Generate Cards</Text>
              <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11, marginTop: 2 }]}>
                AI creates study cards automatically
              </Text>
            </View>
          </View>

          <View style={[styles.infoCard, { borderLeftColor: colors.teal }]}>
            <Text style={styles.infoIcon}>🧠</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[typography.caption, { color: colors.textMuted, fontWeight: "600" }]}>Smart Review</Text>
              <Text style={[typography.caption, { color: colors.textMuted, fontSize: 11, marginTop: 2 }]}>
                Spaced repetition keeps knowledge fresh
              </Text>
            </View>
          </View>
        </View>

        {/* Input section */}
        <View style={styles.inputSection}>
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 12 }]}>TOPIC DETAILS</Text>

          <View style={styles.inputGroup}>
            <Text style={[typography.bodyMedium, { marginBottom: 8 }]}>Topic Name *</Text>
            <TextInput
              placeholder="e.g., Spanish Vocabulary, Biology 101"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={name}
              onChangeText={setName}
              editable={!loading}
              maxLength={120}
            />
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 6, textAlign: "right" }]}>
              {name.length}/120
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[typography.bodyMedium, { marginBottom: 8 }]}>Description (Optional)</Text>
            <TextInput
              placeholder="Add context or goals for this topic..."
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { height: 80 }]}
              multiline
              value={description}
              onChangeText={setDescription}
              editable={!loading}
              maxLength={300}
            />
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 6, textAlign: "right" }]}>
              {description.length}/300
            </Text>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.buttonGroup}>
          <Pressable
            style={[styles.secondaryButton, { opacity: loading ? 0.6 : 1 }]}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={[typography.button, { color: colors.text }]}>Cancel</Text>
          </Pressable>
          <Button
            label={loading ? "Creating…" : "Create Topic"}
            onPress={handleCreate}
            loading={loading}
            style={{ flex: 1 }}
          />
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoCards: {
    gap: 10,
    marginBottom: 28,
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderLeftWidth: 4,
    padding: 12,
    alignItems: "flex-start",
  },
  infoIcon: {
    fontSize: 24,
    marginTop: 2,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
