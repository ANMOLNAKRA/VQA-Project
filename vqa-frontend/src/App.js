import React, { useState, useRef, useEffect } from "react";
import "./App.css";

const ImageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21 15 16 10 5 21"></polyline>
  </svg>
);

const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
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
  const [image, setImage] = useState(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const chatBoxRef = useRef(null);
  const fileInputRef = useRef(null);

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
    const formattedMessages = [];
    let sessionImage = null;
    session.messages.forEach((chat, index) => {
      if (index === 0 && chat.image) {
        sessionImage = chat.image;
      }
      formattedMessages.push({ 
        type: "user", 
        text: chat.question, 
        time: formatTime(chat.times),
        image: index === 0 ? chat.image : null
      });
      formattedMessages.push({ 
        type: "bot", 
        text: chat.answer, 
        time: formatTime(chat.times)
      });
    });
    setMessages(formattedMessages);
    setImage(sessionImage);
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  const handleNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setImage(null);
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  const handleSubmit = async () => {
    if ((!image && !currentSessionId) || !question.trim() || loading) return;

    const isFile = image && typeof image !== 'string';
    let imageUrl = null;
    if (isFile) {
      imageUrl = URL.createObjectURL(image);
    } else if (image && typeof image === 'string') {
      imageUrl = image;
    }

    const isFirstMessage = messages.length === 0;

    const userMessage = {
      type: "user",
      text: question,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      image: isFirstMessage ? imageUrl : null,
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      setCurrentSessionId(sessionId);
    }

    const formData = new FormData();
    if (isFile) {
      formData.append("file", image);
    }
    formData.append("question", question);
    formData.append("history", JSON.stringify(messages));
    formData.append("session_id", sessionId);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/ask`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

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
    // Persist image across turns; do not clear it here

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
            <h1>VQA Chatbot</h1>
          </div>

          <div className="chat-box" ref={chatBoxRef}>
            {messages.length === 0 ? (
              <div className="empty-state">
                <RobotIcon />
                <p>Upload an image and ask a question to get started.</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className={`msg-wrapper ${msg.type}`}>
                  <div className="msg-bubble">
                    {msg.image && <img src={msg.image} alt="Uploaded content" />}
                    {msg.text && <><p style={{ margin: 0 }}>{msg.text}</p><span className="message-time">{msg.time}</span></>}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="msg-wrapper bot">
                <div className="msg-bubble">
                  <div className="thinking-indicator">
                    <div className="dot"></div>
                    <div className="dot"></div>
                    <div className="dot"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="input-area">
            <label className={`upload-label ${image ? 'active' : ''}`} title={image ? "Active Image" : "Upload Image"}>
              {image ? (
                <img src={typeof image === 'string' ? image : URL.createObjectURL(image)} alt="active context" style={{ width: '24px', height: '24px', borderRadius: '4px', objectFit: 'cover' }} />
              ) : (
                <ImageIcon />
              )}
              {!image && (
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden-file-input"
                  onChange={(e) => {
                    const file = e.target.files[0];

                    if (!file) return;

                    if (!file.type.startsWith("image/")) {
                      alert("please upload a valid image.");
                      return;
                    }

                    if (file.size > 5 * 1024 * 1024) {
                      alert("image is large too must be under 5 MB ");
                      return;
                    }

                    setImage(file);
                  }}
                />
              )}
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
              disabled={(!image && !currentSessionId) || !question.trim() || loading}
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;