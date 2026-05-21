# pyrefly: ignore [missing-import]
from fastapi import FastAPI, File, UploadFile, Form
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
from typing import Optional
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


@app.get("/history")
async def get_history():
    pipeline = [
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
    
    formatted_sessions = []
    for s in sessions:
        formatted_sessions.append({
            "session_id": str(s["_id"]),
            "title": s.get("first_question", "New Chat"),
            "timestamp": s.get("timestamp", ""),
            "messages": s.get("messages", [])
        })

    return formatted_sessions

@app.post("/ask")
async def ask_question(
    question: str = Form(...),  
    history: str = Form(...),
    session_id: str = Form(...),
    file: Optional[UploadFile] = File(None)
):
    chat_history = json.loads(history)
    context = ""
    for message in chat_history[-4:]:
        context += f"{message['type']}:{message['text']}\n"
    

    
    image_data_url = None
    
    if file is not None:
        # Read image
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        image_base64 = base64.b64encode(image_bytes).decode("utf-8")
        content_type = file.content_type or "image/jpeg"
        image_data_url = f"data:{content_type};base64,{image_base64}"
    else:
        # Fetch existing image from session
        session_messages = list(chat_collection.find({"session_id": session_id}).sort("_id", 1))
        found_image = False
        for msg in session_messages:
            if msg.get("image"):
                fetched_image_url = msg["image"]
                header, base64_data = fetched_image_url.split(",", 1)
                image_bytes = base64.b64decode(base64_data)
                image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                found_image = True
                break
                
        if not found_image:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="No image provided and no previous image found in session")
    
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

    chat_data = {
        "session_id": session_id,
        "question": question,
        "answer": answer,
        "times": datetime.utcnow().isoformat() + "Z",
    }
    
    if image_data_url is not None:
        chat_data["image"] = image_data_url
    
    chat_collection.insert_one(chat_data)
    
    return {"answer": answer}