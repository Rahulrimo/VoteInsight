import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()
client = MongoClient(os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017"))
db = client[os.getenv("MONGO_DB", "voteinsight")]
users = db.users
elections = db.elections
votes = db.votes
