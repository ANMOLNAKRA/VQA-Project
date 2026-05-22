# pyrefly: ignore [missing-import]
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
# pyrefly: ignore [missing-import]
from transformers import Blip2Processor, Blip2ForConditionalGeneration
# pyrefly: ignore [missing-import]
from PIL import Image
# pyrefly: ignore [missing-import]
import torch      
import io
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
import json
import base64
from database import chat_collection # pyrefly: ignore [missing-import]
from datetime import datetime
from typing import List, Optional
import requests



app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model once (IMPORTANT)
processor = Blip2Processor.from_pretrained("Salesforce/blip2-opt-2.7b")
model = Blip2ForConditionalGeneration.from_pretrained("Salesforce/blip2-opt-2.7b",torch_dtype=torch.float32,device_map="cpu")

def enhance_with_qwen(question, raw_answer, context=""):

    prompt = f"""
    You are an AI visual assistant.

    Previous conversation:
    {context}

    User Question:
    {question}

    Vision Model Analysis:
    {raw_answer}

    Generate a natural, conversational, intelligent response.
    """

    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "qwen2.5:1.5b",
                "prompt": prompt,
                "stream": False
            },
            timeout=120
        )

        result = response.json()

        return result["response"]
    
    except Exception as e:

        print("qwen api error:",e) 

        return raw_answer

def utc_now():
    return datetime.utcnow().isoformat() + "Z"

async def upload_to_data_url(file: UploadFile):
    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")
    content_type = file.content_type or "image/jpeg"
    return image, f"data:{content_type};base64,{image_base64}"

def image_from_data_url(image_data_url: str):
    _header, base64_data = image_data_url.split(",", 1)
    image_bytes = base64.b64decode(base64_data)
    return Image.open(io.BytesIO(image_bytes)).convert("RGB")

def get_message_images(message):
    images = message.get("images") or []
    if message.get("imageUrl"):
        images.append(message["imageUrl"])
    if message.get("image"):
        images.append(message["image"])
    return [image for image in images if image]

def find_latest_session_image(session_id: str):
    session = chat_collection.find_one({"session_id": session_id, "messages": {"$exists": True}})
    if session:
        for message in reversed(session.get("messages", [])):
            images = get_message_images(message)
            if images:
                return images[-1]

    legacy_messages = list(chat_collection.find({
        "session_id": session_id,
        "messages": {"$exists": False},
    }).sort("_id", -1))
    for message in legacy_messages:
        images = get_message_images(message)
        if images:
            return images[-1]

    return None

def normalize_session_messages(messages):
    normalized = []
    for message in messages:
        if message.get("type"):
            normalized.append({
                "type": message.get("type"),
                "text": message.get("text") or message.get("question") or message.get("answer") or "",
                "time": message.get("times") or message.get("time"),
                "times": message.get("times") or message.get("time"),
                "images": get_message_images(message),
            })
            continue

        normalized.append({
            "type": "user",
            "text": message.get("question", ""),
            "time": message.get("times"),
            "times": message.get("times"),
            "images": get_message_images(message),
        })
        normalized.append({
            "type": "bot",
            "text": message.get("answer", ""),
            "time": message.get("times"),
            "times": message.get("times"),
            "images": [],
        })

    return normalized


@app.get("/history")
async def get_history():
    session_docs = list(chat_collection.find(
        {"messages": {"$exists": True}},
        {"_id": 0}
    ).sort("updated_at", -1))

    formatted_sessions = []
    seen_session_ids = set()
    for session in session_docs:
        session_id = str(session.get("session_id", ""))
        seen_session_ids.add(session_id)
        messages = normalize_session_messages(session.get("messages", []))
        first_user_message = next((message for message in messages if message["type"] == "user" and message["text"]), None)
        formatted_sessions.append({
            "session_id": session_id,
            "title": session.get("title") or (first_user_message["text"] if first_user_message else "New Chat"),
            "timestamp": session.get("updated_at") or session.get("created_at") or "",
            "messages": messages,
        })

    pipeline = [
        {"$match": {
            "messages": {"$exists": False},
            "session_id": {"$nin": list(seen_session_ids)}
        }},
        {"$sort": {"_id": 1}},
        {"$group": {
            "_id": {"$ifNull": ["$session_id", {"$toString": "$_id"}]},
            "first_question": {"$first": "$question"},
            "timestamp": {"$last": {"$ifNull": ["$times", {"$dateToString": {"date": {"$toDate": "$_id"}, "format": "%Y-%m-%dT%H:%M:%S.%LZ"}}]}},
            "messages": {"$push": {
                "question": "$question", 
                "answer": "$answer", 
                "times": "$times",
                "image": "$image"
            }}
        }},
        {"$sort": {"timestamp": -1}}
    ]
    sessions = list(chat_collection.aggregate(pipeline))

    for s in sessions:
        formatted_sessions.append({
            "session_id": str(s["_id"]),
            "title": s.get("first_question", "New Chat"),
            "timestamp": s.get("timestamp", ""),
            "messages": normalize_session_messages(s.get("messages", []))
        })

    formatted_sessions.sort(key=lambda session: session.get("timestamp", ""), reverse=True)
    return formatted_sessions

@app.post("/ask")
async def ask_question(
    question: str = Form(...),  
    history: str = Form(...),
    session_id: str = Form(...),
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None)
):
    chat_history = json.loads(history)
    context = ""
    for message in chat_history[-4:]:
        context += f"{message.get('type')}:{message.get('text')}\n"

    uploaded_files = []
    if files:
        uploaded_files.extend([uploaded_file for uploaded_file in files if uploaded_file is not None])
    if file is not None:
        uploaded_files.append(file)

    image_data_urls = []

    if uploaded_files:
        images = []
        for uploaded_file in uploaded_files:
            uploaded_image, image_data_url = await upload_to_data_url(uploaded_file)
            images.append(uploaded_image)
            image_data_urls.append(image_data_url)
        image = images[-1]
    else:
        latest_image_url = find_latest_session_image(session_id)
        if not latest_image_url:
            raise HTTPException(status_code=400, detail="No image provided and no previous image found in session")
        image = image_from_data_url(latest_image_url)
    
    # Process input
    blip_prompt = f"Question: {question} Answer:"
    inputs = processor(images=image, text=blip_prompt, return_tensors="pt")
    
    print(f"--- MODEL INPUT ---")
    print(f"Prompt fed to BLIP-2: {blip_prompt}")
    print(f"Image tensor shape: {inputs['pixel_values'].shape}")
     
    # Generate answer
    out = model.generate(**inputs, max_new_tokens=50)
    raw_answer = processor.decode(out[0], skip_special_tokens=True).strip()
    
    print(f"--- MODEL OUTPUT ---")
    print(f"Raw answer from BLIP-2: {raw_answer}")
    
    # Strip prompt if present
    if raw_answer.startswith(blip_prompt):
        raw_answer = raw_answer[len(blip_prompt):].strip()
    
    print(f"Sliced answer: {raw_answer}")
    
    answer = enhance_with_qwen(question, raw_answer, context)

    timestamp = utc_now()
    user_message = {
        "type": "user",
        "text": question,
        "times": timestamp,
        "images": image_data_urls,
    }
    bot_message = {
        "type": "bot",
        "text": answer,
        "times": timestamp,
        "images": [],
    }

    existing_session = chat_collection.find_one({"session_id": session_id, "messages": {"$exists": True}})
    if existing_session:
        chat_collection.update_one(
            {"session_id": session_id, "messages": {"$exists": True}},
            {
                "$push": {"messages": {"$each": [user_message, bot_message]}},
                "$set": {"updated_at": timestamp},
            },
        )
    else:
        legacy_session_messages = list(chat_collection.find({
            "session_id": session_id,
            "messages": {"$exists": False},
        }).sort("_id", 1))
        migrated_messages = normalize_session_messages(legacy_session_messages)
        first_user_message = next((message for message in migrated_messages if message["type"] == "user" and message["text"]), None)

        chat_collection.insert_one({
            "session_id": session_id,
            "title": first_user_message["text"] if first_user_message else question,
            "created_at": timestamp,
            "updated_at": timestamp,
            "messages": [*migrated_messages, user_message, bot_message],
        })
    
    return {"answer": answer, "images": image_data_urls}


