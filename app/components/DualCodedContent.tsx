import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import { typography, radii } from "@/theme/typography";

interface DualCodedContentProps {
  text: string;
  visualDescription?: string;
  icon?: string;
}

export function DualCodedContent({ text, visualDescription, icon }: DualCodedContentProps) {
  return (
    <View style={styles.container}>
      <View style={styles.textSection}>
        <Text style={[typography.body, { color: colors.text }]}>{text}</Text>
      </View>

      {(visualDescription || icon) && (
        <View style={styles.visualSection}>
          <View style={styles.visualBox}>
            {icon && <Text style={styles.icon}>{icon}</Text>}
            {visualDescription && (
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: icon ? 8 : 0 }]}>
                {visualDescription}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 14,
    marginVertical: 8,
  },
  textSection: {
    marginBottom: 12,
  },
  visualSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  visualBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: 12,
    alignItems: "center",
  },
  icon: {
    fontSize: 32,
  },
});
