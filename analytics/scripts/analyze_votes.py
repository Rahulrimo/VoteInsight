import os
import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("server/.env")
client = MongoClient(os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017"))
db = client[os.getenv("MONGO_DB", "voteinsight")]
rows = list(db.votes.find({}, {"_id": 0}))
df = pd.DataFrame(rows)

if df.empty:
    print("No vote data available yet.")
else:
    print("Total votes:", len(df))
    print("\nVotes by region:\n", df["region"].value_counts())
    print("\nVotes by age group:\n", df["age_group"].value_counts())
    os.makedirs("analytics/data", exist_ok=True)
    df.to_csv("analytics/data/votes_powerbi.csv", index=False)
    print("\nExported analytics/data/votes_powerbi.csv")
