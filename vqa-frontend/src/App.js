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

function App() {
  const [image, setImage] = useState(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const chatBoxRef = useRef(null);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSubmit = async () => {
    if (!image || !question.trim() || loading) return;

    const imageUrl = URL.createObjectURL(image);
    const userMessage = {
      type: "user",
      text: question,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      image: imageUrl,
    };

    URL.revokeObjectURL(imageUrl);

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", image);
    formData.append("question", question);
    formData.append("history", JSON.stringify(messages));

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
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { type: "bot", text: "backend unavailable or request failed error.", },])
    }

    setLoading(false);
    setQuestion("");
    setImage(null); // Clear the image after sending
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="app">
      <div className="chat-container">
        <div className="chat-header">
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
          <label className={`upload-label ${image ? 'active' : ''}`} title="Upload Image">
            <ImageIcon />
            <input
              type="file"
              accept="image/*"
              className="hidden-file-input"
              onChange={(e) => {
                const file = e.target.files[0];

                if (file && file.size > 5 * 1024 * 1024) {
                  alert("image is large too must be under 5 MB ");
                  return;
                }

                setImage(file);
              }}
            />
          </label>

          <input
            type="text"
            className="text-input"
            placeholder="Ask something about the image..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {image && (
            <div className="image-preview">
              <p>{image.name}</p>
              <img
                src={URL.createObjectURL(image)}
                alt="preview"
                className="preview-img"
              />
            </div>
          )}


          <button
            className="send-btn"
            onClick={handleSubmit}
            disabled={!image || !question.trim() || loading}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;