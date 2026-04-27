import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Sparkles, Plus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { type ChatMessage } from '../../types';
import { sanitizeInput } from '../../utils/sanitize';
import './ChatPanel.css';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isGenerating: boolean;
  onNewChat?: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  isGenerating,
  onNewChat,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isGenerating) {
      // SEC-03: Apply sanitization to user input before sending
      const sanitizedContent = sanitizeInput(input.trim());
      onSendMessage(sanitizedContent);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="header-title">
          <Bot size={18} className="icon-ai" />
          <span>AI Assistant</span>
        </div>
        <button className="btn-new-chat" onClick={onNewChat}>
          <Plus size={16} />
        </button>
      </div>

      <div className="messages-list">
        {messages.length === 0 ? (
          <div className="empty-state">
            <Sparkles size={32} className="empty-icon" />
            <h3>Start building</h3>
            <p>Describe what you want to create and let the AI do the magic.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`message-item ${msg.role}`}
              data-testid="message-item"
              data-role={msg.role}
            >
              <div className="message-avatar">
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className="message-content">
                <div className="message-header">
                  <span className="sender">{msg.role === 'user' ? 'You' : 'AI Assistant'}</span>
                </div>
                <div className="message-text">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))
        )}
        {isGenerating && (
          <div
            className="message-item assistant generating"
            data-testid="message-item"
            data-role="assistant"
          >
            <div className="message-avatar pulse">
              <Bot size={16} />
            </div>
            <div className="message-content">
              <div className="message-header">
                <span className="sender">AI Assistant</span>
              </div>
              <div className="typing-indicator" data-testid="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <form className="chat-input-form" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe an enhancement or a bug fix..."
            rows={1}
            disabled={isGenerating}
          />
          <button type="submit" className="btn-send" disabled={!input.trim() || isGenerating}>
            <Send size={18} />
          </button>
        </form>
        <p className="input-hint">Enter to send, Shift+Enter for new line</p>
      </div>
    </div>
  );
};

export default ChatPanel;
