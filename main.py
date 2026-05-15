from fastapi import FastAPI, File, UploadFile, Form
from transformers import BlipProcessor, BlipForQuestionAnswering
from PIL import Image
import torch
import io
from fastapi.middleware.cors import CORSMiddleware
import json



app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model once (IMPORTANT)
processor = BlipProcessor.from_pretrained("Salesforce/blip-vqa-base")
model = BlipForQuestionAnswering.from_pretrained("Salesforce/blip-vqa-base")

@app.post("/ask")
async def ask_question(file: UploadFile = File(...), question: str = Form(...), history: str = Form(...)):
    chat_history = json.loads(history)
    context = ""
    for message in chat_history[-4:]:
        context += f"{message['type']}:{message['text']}\n"
    full_question = context+"\ncurrent question: "+question

    
    # Read image
    image_bytes = await file.read()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    
    # Process input
    inputs = processor(image, full_question, return_tensors="pt")
    
    # Generate answer
    out = model.generate(**inputs)
    answer = processor.decode(out[0], skip_special_tokens=True)
    
    return {"answer": answer}