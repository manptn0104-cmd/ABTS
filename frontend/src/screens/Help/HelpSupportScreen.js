import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Shadow, Typography } from '../../theme';
import {
  sendSupportMessage,
  getSupportMessages,
} from '../../api/support';
const DUMMY_RESPONSES = [
  "I'm here to help! What's your concern? 👋",
  "Could you provide more details? That will help me assist you better.",
  "Thank you for contacting ABTS Support. We're committed to resolving your issue quickly.",
  "Have you tried restarting the app? This often resolves common issues.",
  "Your feedback is valuable to us. Please let us know how we can improve.",
  "I understand your concern. Let me connect you with our support team for further assistance.",
];

export default function HelpSupportScreen({ navigation }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello 👋 How can we help you today?",
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef(null);

  const loadMessages = async () => {

  try {

    const response =
      await getSupportMessages();

    const formattedMessages =
      response.data.data.map((msg, index) => ({
        id: index + 1,
        text: msg.message,
        sender: msg.sender,
        timestamp: new Date(msg.createdAt),
      }));

    setMessages(formattedMessages);

  } catch (error) {

    console.log(error);

  }
};
useEffect(() => {

  loadMessages();

}, []);

useEffect(() => {

  scrollViewRef.current?.scrollToEnd({
    animated: true,
  });

}, [messages]);

  const handleSendMessage = async () => {

  if (inputText.trim() === '') return;

  try {

    setIsLoading(true);

    // Save user message to MongoDB

    await sendSupportMessage({
      sender: 'user',
      message: inputText,
    });

    setInputText('');

    // Reload messages from database

    await loadMessages();

    // Dummy bot reply for now

    setTimeout(async () => {

      const randomResponse =
        DUMMY_RESPONSES[
          Math.floor(
            Math.random() *
            DUMMY_RESPONSES.length
          )
        ];

      // Save bot reply to MongoDB

      await sendSupportMessage({
        sender: 'bot',
        message: randomResponse,
      });

      // Reload again

      await loadMessages();

      setIsLoading(false);

    }, 1000);

  } catch (error) {

    console.log(error);

    setIsLoading(false);

  }
};

  const handleGoBack = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Help & Support</Text>
          <Text style={styles.headerSubtitle}>AI Assistant</Text>
        </View>
        <View style={styles.headerIcon}>
          <View style={styles.statusDot} />
          <MaterialCommunityIcons name="robot" size={24} color={Colors.white} />
        </View>
      </View>

      {/* Chat Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageWrapper,
              message.sender === 'user' ? styles.userMessageWrapper : styles.botMessageWrapper,
            ]}
          >
            {message.sender === 'bot' && (
              <View style={styles.botAvatar}>
                <MaterialCommunityIcons name="robot-happy" size={18} color={Colors.white} />
              </View>
            )}
            <View
              style={[
                styles.messageBubble,
                message.sender === 'user' ? styles.userBubble : styles.botBubble,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  message.sender === 'user' && styles.userMessageText,
                ]}
              >
                {message.text}
              </Text>
              <Text
                style={[
                  styles.timestamp,
                  message.sender === 'user' && styles.userTimestamp,
                ]}
              >
                {formatTime(message.timestamp)}
              </Text>
            </View>
            {message.sender === 'user' && (
              <View style={styles.userAvatar}>
                <MaterialCommunityIcons name="account-circle" size={18} color={Colors.white} />
              </View>
            )}
          </View>
        ))}

        {isLoading && (
          <View style={[styles.messageWrapper, styles.botMessageWrapper]}>
            <View style={styles.botAvatar}>
              <MaterialCommunityIcons name="robot-happy" size={18} color={Colors.white} />
            </View>
            <View style={[styles.messageBubble, styles.botBubble]}>
              <View style={styles.typingIndicator}>
                <View style={[styles.typingDot, styles.typingDotActive]} />
                <View style={styles.typingDot} />
                <View style={styles.typingDot} />
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Type your message..."
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isLoading}
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={inputText.trim() === '' || isLoading}
            style={[
              styles.sendButton,
              (inputText.trim() === '' || isLoading) && styles.sendButtonDisabled,
            ]}
          >
            <MaterialCommunityIcons
              name="send"
              size={20}
              color={inputText.trim() === '' || isLoading ? Colors.textMuted : Colors.white}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Shadow.medium,
  },
  backButton: {
    padding: Spacing.sm,
    marginRight: Spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.primaryLight,
    marginTop: 2,
  },
  headerIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  messageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  userMessageWrapper: {
    justifyContent: 'flex-end',
  },
  botMessageWrapper: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  userBubble: {
    backgroundColor: Colors.primary,
  },
  botBubble: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  userMessageText: {
    color: Colors.white,
  },
  timestamp: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  userTimestamp: {
    color: Colors.primaryLight,
    textAlign: 'right',
  },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textMuted,
  },
  typingDotActive: {
    backgroundColor: Colors.secondary,
  },
  inputContainer: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 14,
    color: Colors.text,
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.light,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.background,
  },
});
