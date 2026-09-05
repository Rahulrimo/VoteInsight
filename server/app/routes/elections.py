from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId
from datetime import datetime
import uuid

from app.db import db


# ============================================================
# ROUTER
# ============================================================

# main.py already adds:
# /api/elections

router = APIRouter()


# ============================================================
# VOTE REQUEST MODEL
# ============================================================

class VoteRequest(BaseModel):
    election_id: str
    voter_id: str
    candidate_id: str


# ============================================================
# GET ALL ELECTIONS
# ============================================================

@router.get("")
def get_elections():

    elections = list(
        db.elections.find({})
    )

    response = []

    for election in elections:

        election_id = election["_id"]

        # Get candidates for this election
        candidates = list(
            db.candidates.find({
                "election_id": election_id
            })
        )

        candidate_list = []

        for candidate in candidates:

            candidate_list.append({
                "_id": str(candidate["_id"]),

                "name": candidate.get(
                    "name",
                    ""
                ),

                "party": candidate.get(
                    "party",
                    ""
                ),

                "symbol": candidate.get(
                    "symbol",
                    ""
                )
            })

        response.append({

            "_id": str(election_id),

            "title": election.get(
                "title",
                "Untitled Election"
            ),

            "description": election.get(
                "description",
                ""
            ),

            "status": election.get(
                "status",
                "UNKNOWN"
            ),

            "start_date": (
                election["start_date"].isoformat()
                if election.get("start_date")
                else None
            ),

            "end_date": (
                election["end_date"].isoformat()
                if election.get("end_date")
                else None
            ),

            "created_at": (
                election["created_at"].isoformat()
                if election.get("created_at")
                else None
            ),

            "candidate_count": len(
                candidate_list
            ),

            "candidates": candidate_list
        })

    return response


# ============================================================
# GET VOTER BY VOTER ID
# ============================================================

@router.get("/voter/{voter_id}")
def get_voter(voter_id: str):

    # Normalize input
    voter_id = voter_id.strip().upper()

    # Find voter
    voter = db.voters.find_one({
        "voter_id": voter_id
    })

    if not voter:

        raise HTTPException(
            status_code=404,
            detail="Voter ID not found."
        )

    # Check if voter already voted
    existing_vote = db.votes.find_one({
        "election_id": voter["election_id"],
        "voter_id": voter["_id"]
    })

    return {

        "_id": str(
            voter["_id"]
        ),

        "voter_id": voter.get(
            "voter_id",
            ""
        ),

        "name": voter.get(
            "name",
            "Demo Voter"
        ),

        "age": voter.get(
            "age"
        ),

        "gender": voter.get(
            "gender"
        ),

        "region": voter.get(
            "region"
        ),

        "has_voted": existing_vote is not None
    }


# ============================================================
# CAST VOTE
# ============================================================

@router.post("/vote")
def cast_vote(
    vote: VoteRequest
):

    # --------------------------------------------------------
    # Validate MongoDB IDs
    # --------------------------------------------------------

    try:

        election_object_id = ObjectId(
            vote.election_id
        )

        candidate_object_id = ObjectId(
            vote.candidate_id
        )

    except Exception:

        raise HTTPException(
            status_code=400,
            detail="Invalid election or candidate ID."
        )


    # --------------------------------------------------------
    # Find election
    # --------------------------------------------------------

    election = db.elections.find_one({
        "_id": election_object_id
    })

    if not election:

        raise HTTPException(
            status_code=404,
            detail="Election not found."
        )


    # --------------------------------------------------------
    # Check election status
    # --------------------------------------------------------

    if election.get("status") != "OPEN":

        raise HTTPException(
            status_code=400,
            detail="Election is not currently open."
        )


    # --------------------------------------------------------
    # Find voter
    # --------------------------------------------------------

    voter_id = vote.voter_id.strip().upper()

    voter = db.voters.find_one({

        "voter_id": voter_id,

        "election_id": election_object_id
    })

    if not voter:

        raise HTTPException(
            status_code=404,
            detail="Voter ID not found."
        )


    # --------------------------------------------------------
    # Find candidate / party
    # --------------------------------------------------------

    candidate = db.candidates.find_one({

        "_id": candidate_object_id,

        "election_id": election_object_id
    })

    if not candidate:

        raise HTTPException(
            status_code=404,
            detail="Candidate / party not found."
        )


    # --------------------------------------------------------
    # Check whether voter already voted
    # --------------------------------------------------------

    existing_vote = db.votes.find_one({

        "election_id": election_object_id,

        "voter_id": voter["_id"]
    })

    if existing_vote:

        raise HTTPException(
            status_code=400,
            detail="This voter has already voted."
        )


    # --------------------------------------------------------
    # Generate receipt
    # --------------------------------------------------------

    receipt_id = (
        "VI-"
        + uuid.uuid4().hex[:12].upper()
    )


    # --------------------------------------------------------
    # Create vote document
    # --------------------------------------------------------

    vote_document = {

        "election_id":
            election_object_id,

        "voter_id":
            voter["_id"],

        "candidate_id":
            candidate_object_id,

        "timestamp":
            datetime.utcnow(),

        "receipt_id":
            receipt_id
    }


    # --------------------------------------------------------
    # Insert vote
    # --------------------------------------------------------

    try:

        result = db.votes.insert_one(
            vote_document
        )

    except Exception as error:

        if "duplicate key" in str(
            error
        ).lower():

            raise HTTPException(
                status_code=400,
                detail="This voter has already voted."
            )

        raise HTTPException(
            status_code=500,
            detail="Unable to record vote."
        )


    # --------------------------------------------------------
    # Return success
    # --------------------------------------------------------

    return {

        "success": True,

        "message":
            "Vote recorded successfully.",

        "receipt_id":
            receipt_id,

        "vote_id":
            str(result.inserted_id)
    }


# ============================================================
# ELECTION RESULTS
# ============================================================

@router.get(
    "/{election_id}/results"
)
def election_results(
    election_id: str
):

    # --------------------------------------------------------
    # Validate election ID
    # --------------------------------------------------------

    try:

        election_object_id = ObjectId(
            election_id
        )

    except Exception:

        raise HTTPException(
            status_code=400,
            detail="Invalid election ID."
        )


    # --------------------------------------------------------
    # Find election
    # --------------------------------------------------------

    election = db.elections.find_one({

        "_id": election_object_id
    })

    if not election:

        raise HTTPException(
            status_code=404,
            detail="Election not found."
        )


    # --------------------------------------------------------
    # Count registered voters
    # --------------------------------------------------------

    registered_voters = (
        db.voters.count_documents({

            "election_id":
                election_object_id
        })
    )


    # --------------------------------------------------------
    # Count total votes
    # --------------------------------------------------------

    total_votes = (
        db.votes.count_documents({

            "election_id":
                election_object_id
        })
    )


    # --------------------------------------------------------
    # Get candidates / parties
    # --------------------------------------------------------

    candidates = list(
        db.candidates.find({

            "election_id":
                election_object_id
        })
    )


    results = []


    # --------------------------------------------------------
    # Calculate results
    # --------------------------------------------------------

    for candidate in candidates:

        vote_count = (
            db.votes.count_documents({

                "election_id":
                    election_object_id,

                "candidate_id":
                    candidate["_id"]
            })
        )


        percentage = 0

        if total_votes > 0:

            percentage = round(

                (
                    vote_count /
                    total_votes
                ) * 100,

                2
            )


        results.append({

            "candidate_id":
                str(
                    candidate["_id"]
                ),

            "name":
                candidate.get(
                    "name",
                    ""
                ),

            "party":
                candidate.get(
                    "party",
                    ""
                ),

            "symbol":
                candidate.get(
                    "symbol",
                    ""
                ),

            "votes":
                vote_count,

            "percentage":
                percentage
        })


    # --------------------------------------------------------
    # Sort by votes
    # --------------------------------------------------------

    results.sort(

        key=lambda candidate:
            candidate["votes"],

        reverse=True
    )


    # --------------------------------------------------------
    # Winner
    # --------------------------------------------------------

    winner = (
        results[0]
        if results
        else None
    )


    # --------------------------------------------------------
    # Turnout
    # --------------------------------------------------------

    turnout_percentage = 0

    if registered_voters > 0:

        turnout_percentage = round(

            (
                total_votes /
                registered_voters
            ) * 100,

            2
        )


    # --------------------------------------------------------
    # Return results
    # --------------------------------------------------------

    return {

        "election_id":
            election_id,

        "title":
            election.get(
                "title",
                ""
            ),

        "status":
            election.get(
                "status",
                ""
            ),

        "registered_voters":
            registered_voters,

        "total_votes":
            total_votes,

        "turnout_percentage":
            turnout_percentage,

        "winner":
            winner,

        "results":
            results
    }