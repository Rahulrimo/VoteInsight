from datetime import datetime, timedelta
from random import choice, randint, seed

from pymongo import MongoClient
from dotenv import load_dotenv
import os


# ============================================================
# LOAD ENVIRONMENT
# ============================================================

load_dotenv()

seed(42)

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("MONGO_DB", "voteinsight")

if not MONGO_URI:
    raise ValueError("MONGO_URI is not set in the .env file")


# ============================================================
# CONNECT TO MONGODB
# ============================================================

client = MongoClient(MONGO_URI)
db = client[MONGO_DB]


# ============================================================
# CLEAR PREVIOUS DEMO DATA
# ============================================================

for collection in [
    "elections",
    "candidates",
    "voters",
    "votes"
]:
    db[collection].delete_many({})


# ============================================================
# 1. CREATE DEMO ELECTION
# ============================================================

now = datetime.utcnow()

election = {
    "title": "National Student Leadership Election 2026",

    "description": (
        "Synthetic demonstration election created for "
        "VoteInsight Election Intelligence."
    ),

    "status": "OPEN",

    "start_date": now - timedelta(days=1),

    "end_date": now + timedelta(days=7),

    "created_at": now
}

election_id = db.elections.insert_one(election).inserted_id


# ============================================================
# 2. CREATE 4 FICTIONAL PARTIES
# ============================================================

party_data = [

    {
        "name": "Progressive Students Party",
        "party": "Party W",
        "symbol": "W"
    },

    {
        "name": "Future India Students",
        "party": "Party X",
        "symbol": "X"
    },

    {
        "name": "Youth Development Front",
        "party": "Party Y",
        "symbol": "Y"
    },

    {
        "name": "Student Reform Alliance",
        "party": "Party Z",
        "symbol": "Z"
    }
]


candidate_ids = []


for party in party_data:

    candidate = {
        "name": party["name"],
        "party": party["party"],
        "symbol": party["symbol"],
        "election_id": election_id,
        "created_at": now
    }

    result = db.candidates.insert_one(candidate)

    candidate_ids.append(result.inserted_id)


# ============================================================
# 3. CREATE 500 SYNTHETIC VOTERS
# ============================================================

regions = [
    "West Bengal",
    "Maharashtra",
    "Karnataka",
    "Delhi",
    "Tamil Nadu",
    "Uttar Pradesh",
    "Rajasthan",
    "Gujarat"
]

genders = [
    "Male",
    "Female",
    "Other"
]


# Fresh voters reserved for frontend testing

demo_names = {
    491: "Rahul Das",
    492: "Arjun Sen",
    493: "Priya Roy",
    494: "Ananya Das",
    495: "Rohan Ghosh",
    496: "Sneha Banerjee",
    497: "Aditya Roy",
    498: "Ishita Sen",
    499: "Sayan Dutta",
    500: "Moumita Das"
}


voter_ids = []


for i in range(1, 501):

    if i in demo_names:
        voter_name = demo_names[i]
    else:
        voter_name = f"Demo Voter {i:04d}"

    voter = {

        "voter_id": f"VOTER-{i:04d}",

        "name": voter_name,

        "age": randint(18, 35),

        "gender": choice(genders),

        "region": choice(regions),

        "election_id": election_id,

        "registered_at": now - timedelta(
            days=randint(30, 90)
        )
    }

    result = db.voters.insert_one(voter)

    voter_ids.append(result.inserted_id)


# ============================================================
# 4. CREATE 360 SYNTHETIC DEMO VOTES
# ============================================================

# First 490 voters are eligible for synthetic votes.
#
# VOTER-0491 through VOTER-0500 are reserved
# exclusively for live frontend testing.

eligible_voters = voter_ids[:490]

voters_who_voted = eligible_voters[:360]

vote_count = 0


for voter_id in voters_who_voted:

    selected_candidate = choice(candidate_ids)

    vote = {

        "election_id": election_id,

        "voter_id": voter_id,

        "candidate_id": selected_candidate,

        "timestamp": now - timedelta(
            days=randint(0, 7),
            hours=randint(0, 23),
            minutes=randint(0, 59)
        )
    }

    db.votes.insert_one(vote)

    vote_count += 1


# ============================================================
# 5. CREATE DATABASE INDEXES
# ============================================================

# Unique voter ID inside an election

db.voters.create_index(
    [
        ("election_id", 1),
        ("voter_id", 1)
    ],
    unique=True
)


# One vote per voter per election

db.votes.create_index(
    [
        ("election_id", 1),
        ("voter_id", 1)
    ],
    unique=True
)


# Faster result queries

db.votes.create_index(
    [
        ("election_id", 1),
        ("candidate_id", 1)
    ]
)


# ============================================================
# 6. DISPLAY SEED RESULTS
# ============================================================

print()

print("=" * 65)
print("              VOTEINSIGHT DEMO DATA")
print("=" * 65)

print()

print(f"Election ID : {election_id}")
print(f"Parties     : {len(candidate_ids)}")
print(f"Voters      : {len(voter_ids)}")
print(f"Votes       : {vote_count}")

print()

print("Election:")
print(election["title"])

print()

print("Status:")
print(election["status"])

print()

print("Turnout:")
print(
    f"{(vote_count / len(voter_ids)) * 100:.1f}%"
)

print()

print("=" * 65)
print("PARTIES")
print("=" * 65)

for party in party_data:

    print(
        f"  {party['symbol']}  "
        f"{party['party']}  -  "
        f"{party['name']}"
    )

print()

print("=" * 65)
print("FRESH TEST VOTERS")
print("=" * 65)

for number, name in demo_names.items():

    print(
        f"  VOTER-{number:04d}  ->  {name}"
    )

print()

print("These 10 voters have NO previous vote.")

print()

print("=" * 65)
print("SEED COMPLETE")
print("=" * 65)


# ============================================================
# CLOSE DATABASE CONNECTION
# ============================================================

client.close()