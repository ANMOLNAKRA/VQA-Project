from pymongo import MongoClient
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Get Mongo URI
MONGO_URI = os.getenv("MONGO_URI")

# Connect MongoDB
client = MongoClient(MONGO_URI)

# Create database
db = client["vqa_chatbot"]

# Create collection
chat_collection = db["chat_history"]

print("MongoDB connected successfully 🚀")