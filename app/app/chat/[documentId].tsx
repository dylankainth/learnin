import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";
import { api } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatScreen() {
  const { documentId, documentTitle } = useLocalSearchParams<{ documentId: string; documentTitle?: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (!documentId) return;

    (async () => {
      try {
        const res = await api.chat.start(documentId);
        setMessages([{ role: "assistant", content: res.initialPrompt }]);
      } catch (err) {
        setMessages([
          {
            role: "assistant",
            content:
              "Error starting chat. Make sure OPENROUTER_API_KEY is configured on your server.",
          },
        ]);
      } finally {
        setInitializing(false);
      }
    })();
  }, [documentId]);

  async function sendMessage() {
    if (!input.trim() || !documentId) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const res = await api.chat.message(userMessage, documentId, messages);
      setMessages((prev) => [...prev, { role: "assistant", content: res.response }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Error: Could not generate response. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (initializing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={[typography.bodyMedium, { color: colors.primary }]}>← Back</Text>
        </Pressable>
        <Text style={[typography.h2]}>{documentTitle || "Learn with Socratic"}</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView style={styles.messagesContainer} contentContainerStyle={{ paddingBottom: 20 }}>
          {messages.map((msg, idx) => (
            <View
              key={idx}
              style={[
                styles.messageBubble,
                msg.role === "user"
                  ? { backgroundColor: colors.primary, alignSelf: "flex-end" }
                  : { backgroundColor: colors.surface, alignSelf: "flex-start" },
              ]}
            >
              <Text
                style={[
                  typography.body,
                  {
                    color: msg.role === "user" ? "#fff" : colors.text,
                  },
                ]}
              >
                {msg.content}
              </Text>
            </View>
          ))}
          {loading && (
            <View style={[styles.messageBubble, { backgroundColor: colors.surface, alignSelf: "flex-start" }]}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Ask a question or share your thoughts..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            editable={!loading}
            multiline
          />
          <Pressable
            style={[styles.sendBtn, { opacity: loading || !input.trim() ? 0.5 : 1 }]}
            onPress={sendMessage}
            disabled={loading || !input.trim()}
          >
            <Text style={[typography.button, { color: "#fff" }]}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  messageBubble: {
    maxWidth: "85%",
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
});
