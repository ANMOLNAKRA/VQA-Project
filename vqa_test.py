from transformers import BlipProcessor, BlipForQuestionAnswering
from PIL import Image
import torch

# Load model + processor
processor = BlipProcessor.from_pretrained("Salesforce/blip-vqa-base")
model = BlipForQuestionAnswering.from_pretrained("Salesforce/blip-vqa-base")

# Load image
image = Image.open("test.jpg").convert("RGB")

# Ask question
question = " what is the breed of this dog ?"

# Prepare inputs
inputs = processor(image, question, return_tensors="pt")

# Generate answer
out = model.generate(**inputs)
answer = processor.decode(out[0], skip_special_tokens=True)

print("Answer:", answer)