import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { COLORS } from "../theme/colors";

type Tab = { label: string; value: string };

interface CategoryTabsProps {
  activeTab: string;
  onChange: (value: string) => void;
  tabs: Tab[];
}

export default function CategoryTabs({
  activeTab,
  onChange,
  tabs,
}: CategoryTabsProps) {
  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderColor: COLORS.grayLight,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8 }}
      >
        {tabs.map((tab) => {
          const isActive = tab.value === activeTab;

          return (
            <Pressable
              key={tab.value}
              onPress={() => onChange(tab.value)}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                marginRight: 8,
                borderBottomWidth: isActive ? 2 : 0,
                borderColor: COLORS.black,
              }}
            >
              <Text
                style={{
                  color: isActive ? COLORS.black : COLORS.textLight,
                  fontWeight: isActive ? "600" : "400",
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
