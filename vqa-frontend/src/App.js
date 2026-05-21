import React, { useState, useRef, useEffect } from "react";
import "./App.css";

const PaperclipIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
  </svg>
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

const BotAvatar = ({ small = false }) => (
  <div className={`bot-avatar ${small ? "small" : ""}`}>
    <RobotIcon />
  </div>
);

const RobotIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2"></rect>
    <circle cx="12" cy="5" r="2"></circle>
    <path d="M12 7v4"></path>
    <line x1="8" y1="16" x2="8" y2="16"></line>
    <line x1="16" y1="16" x2="16" y2="16"></line>
  </svg>
);

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const formatDate = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatTime = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

function App() {
  const [stagedImages, setStagedImages] = useState([]);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const chatBoxRef = useRef(null);
  const fileInputRef = useRef(null);

  const hasImageContext = messages.some((message) => message.images?.length || message.image);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/history`, {});
      const data = await response.json();
      setSessions(data);
    } catch (error) {
      console.error("Error fetching chat history:", error);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSessionClick = (session) => {
    setCurrentSessionId(session.session_id);
    const formattedMessages = session.messages.map((chat) => ({
      type: chat.type,
      text: chat.text || chat.question || chat.answer || "",
      time: formatTime(chat.times || chat.time),
      images: chat.images || (chat.image ? [chat.image] : []),
    }));
    setMessages(formattedMessages);
    clearStagedImages();
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    clearStagedImages();
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  const stageFiles = (fileList) => {
    const validFiles = Array.from(fileList).filter((file) => {
      if (!file.type.startsWith("image/")) {
        alert("please upload a valid image.");
        return false;
      }

      if (file.size > 5 * 1024 * 1024) {
        alert("image is too large and must be under 5 MB.");
        return false;
      }

      return true;
    });

    if (!validFiles.length) return;

    setStagedImages((prev) => [
      ...prev,
      ...validFiles.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  };

  const clearStagedImages = () => {
    setStagedImages((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeStagedImage = (indexToRemove) => {
    setStagedImages((prev) => {
      const imageToRemove = prev[indexToRemove];
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.previewUrl);
      }
      return prev.filter((_, index) => index !== indexToRemove);
    });
  };

  const handleSubmit = async () => {
    if ((!stagedImages.length && !currentSessionId && !hasImageContext) || !question.trim() || loading) return;

    const userMessage = {
      type: "user",
      text: question,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      images: stagedImages.map((image) => image.previewUrl),
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      setCurrentSessionId(sessionId);
    }

    const formData = new FormData();
    stagedImages.forEach((image) => {
      formData.append("files", image.file);
    });
    formData.append("question", question);
    formData.append("history", JSON.stringify(messages));
    formData.append("session_id", sessionId);

    setStagedImages([]);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/ask`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Request failed");
      }

      const botMessage = {
        type: "bot",
        text: data.answer,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setMessages((prev) => [...prev, botMessage]);
      fetchHistory(); // Refresh sidebar history
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { type: "bot", text: "backend unavailable or request failed error." }]);
    }

    setLoading(false);
    setQuestion("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Overlay for Mobile */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)}></div>

      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Chat History</h2>
          <button className="new-chat-btn" onClick={handleNewChat}>
            <PlusIcon />
          </button>
        </div>
        <div className="sidebar-content">
          {sessions.length === 0 ? (
            <p className="sidebar-empty">No previous chats found.</p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.session_id}
                className={`history-item ${currentSessionId === session.session_id ? 'active' : ''}`}
                onClick={() => handleSessionClick(session)}
              >
                <div className="history-title">{session.title}</div>
                {session.timestamp && (
                  <div className="history-time">
                    {formatDate(session.timestamp)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="app">
        <div className="chat-container">
          <div className="chat-header">
            <button className="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <MenuIcon />
            </button>
            <div className="chat-title">
              <BotAvatar small />
              <h1>VQA Chatbot</h1>
            </div>
          </div>

          <div className="chat-box" ref={chatBoxRef}>
            {messages.length === 0 ? (
              <div className="empty-state">
                <BotAvatar />
                <p>Upload an image and ask a question to get started.</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className={`msg-wrapper ${msg.type}`}>
                  <div className="message-line">
                    {msg.type === "bot" && <BotAvatar small />}
                    <div className="message-stack">
                      <div className="msg-bubble">
                        {(msg.images || (msg.image ? [msg.image] : [])).length > 0 && (
                          <div className="message-images">
                            {(msg.images || (msg.image ? [msg.image] : [])).map((imageUrl, imageIndex) => (
                              <img key={`${index}-${imageIndex}`} src={imageUrl} alt="Uploaded content" />
                            ))}
                          </div>
                        )}
                        {msg.text && <p>{msg.text}</p>}
                      </div>
                      {msg.time && <span className="message-time">{msg.time}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="msg-wrapper bot">
                <div className="message-line">
                  <BotAvatar small />
                  <div className="message-stack">
                    <div className="msg-bubble">
                      <div className="thinking-indicator">
                        <div className="dot"></div>
                        <div className="dot"></div>
                        <div className="dot"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            className="input-area"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              stageFiles(e.dataTransfer.files);
            }}
          >
            {stagedImages.length > 0 && (
              <div className="staged-images">
                {stagedImages.map((image, index) => (
                  <div className="staged-image" key={image.previewUrl}>
                    <img src={image.previewUrl} alt="Staged upload" />
                    <button type="button" onClick={() => removeStagedImage(index)} aria-label="Remove staged image">
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="input-row">
            <label className={`upload-label ${stagedImages.length ? 'active' : ''}`} title="Attach image">
                <PaperclipIcon />
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                multiple
                className="hidden-file-input"
                onChange={(e) => stageFiles(e.target.files)}
              />
            </label>

            <input
              type="text"
              className="text-input"
              placeholder={loading ? "waiting for response" : "Ask something about the image..."}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            <button
              className="send-btn"
              onClick={handleSubmit}
              disabled={(!stagedImages.length && !currentSessionId && !hasImageContext) || !question.trim() || loading}
            >
              <SendIcon />
            </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
