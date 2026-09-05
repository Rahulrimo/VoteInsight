# VoteInsight — Election Intelligence Platform

Portfolio-grade demo election management and analytics platform using React, FastAPI, MongoDB, Pandas and Power BI-ready exports.

> **Demo only:** uses synthetic election data and is not intended for real-world election use.

## Run

### Backend
```bash
cd server
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd client
npm install
copy .env.example .env
npm run dev
```

Default frontend API: `http://localhost:8000/api`

## Analytics
After votes exist:
```bash
python analytics/scripts/analyze_votes.py
```
This creates `analytics/data/votes_powerbi.csv`, which can be loaded into Power BI.
