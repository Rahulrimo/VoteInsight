import { useEffect, useRef, useState } from "react";
import "./index.css";

const API =
  import.meta.env.VITE_API_URL || "http://localhost:8001/api";

function App() {
  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState(null);
  const [candidates, setCandidates] = useState([]);

  const [screen, setScreen] = useState("home");

  const [voterId, setVoterId] = useState("");
  const [voter, setVoter] = useState(null);

  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const [message, setMessage] = useState("");
  const [results, setResults] = useState(null);
  const [receiptId, setReceiptId] = useState("");

  // Camera
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraError, setCameraError] = useState("");

  // ============================================================
  // LOAD ELECTION
  // ============================================================

  useEffect(() => {
    loadElections();

    return () => {
      stopCamera();
    };
  }, []);

  async function loadElections() {
    try {
      const response = await fetch(`${API}/elections`);

      if (!response.ok) {
        throw new Error("Election API error");
      }

      const data = await response.json();

      setElections(data);

      if (data.length > 0) {
        setSelectedElection(data[0]);
        setCandidates(data[0].candidates || []);
      }
    } catch (error) {
      console.error(error);
      setMessage("Unable to connect to VoteInsight API.");
    }
  }

  // ============================================================
  // START VOTING
  // ============================================================

  function startVoting() {
    setVoterId("");
    setVoter(null);
    setSelectedCandidate(null);
    setMessage("");
    setCameraError("");
    setCameraStarted(false);

    setScreen("voter");
  }

  // ============================================================
  // FIND VOTER
  // ============================================================

  async function verifyVoter() {
    if (!voterId.trim()) {
      setMessage("Please enter your voter ID.");
      return;
    }

    if (!selectedElection) {
      setMessage("No election is available.");
      return;
    }

    setMessage("");

    try {
      const response = await fetch(
        `${API}/elections/voter/${encodeURIComponent(
          voterId.trim()
        )}`
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail || "Voter ID was not found."
        );
        return;
      }

      setVoter(data);

      setScreen("identity");
    } catch (error) {
      console.error(error);

      setMessage(
        "Unable to verify voter. Please check the server."
      );
    }
  }

  // ============================================================
  // CONFIRM VOTER NAME
  // ============================================================

  function confirmIdentity() {
    setMessage("");
    setCameraError("");
    setCameraStarted(false);

    setScreen("camera");
  }

  function rejectIdentity() {
    setVoter(null);
    setVoterId("");
    setMessage("");

    setScreen("voter");
  }

  // ============================================================
  // CAMERA
  // ============================================================

  async function startCamera() {
    setCameraError("");

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraError(
        "Camera access is not supported by this browser."
      );
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user",
          },
          audio: false,
        });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        try {
          await videoRef.current.play();
        } catch (error) {
          console.log(error);
        }
      }

      setCameraStarted(true);
      setMessage("");
    } catch (error) {
      console.error(error);

      if (error.name === "NotAllowedError") {
        setCameraError(
          "Camera permission was denied. Please allow camera access."
        );
      } else if (error.name === "NotFoundError") {
        setCameraError(
          "No camera was found on this device."
        );
      } else {
        setCameraError(
          "Unable to access the camera. Please check your camera permissions."
        );
      }
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => track.stop());

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraStarted(false);
  }

  // ============================================================
  // CONTINUE FROM CAMERA
  // ============================================================

  function continueFromCamera() {
    if (!cameraStarted) {
      setCameraError(
        "Camera verification is required before voting."
      );
      return;
    }

    stopCamera();
    setSelectedCandidate(null);
    setMessage("");

    setScreen("booth");
  }

  // ============================================================
  // SELECT PARTY
  // ============================================================

  function selectCandidate(candidate) {
    setSelectedCandidate(candidate);
    setMessage("");
  }

  // ============================================================
  // KEYBOARD 1-4
  // ============================================================

  useEffect(() => {
    function handleKeyDown(event) {
      if (screen !== "booth") {
        return;
      }

      const number = Number(event.key);

      if (
        number >= 1 &&
        number <= 4 &&
        candidates[number - 1]
      ) {
        selectCandidate(candidates[number - 1]);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [screen, candidates]);

  // ============================================================
  // GO TO CONFIRMATION
  // ============================================================

  function reviewVote() {
    if (!selectedCandidate) {
      setMessage("Please select a party first.");
      return;
    }

    setMessage("");
    setScreen("confirm");
  }

  // ============================================================
  // SUBMIT VOTE
  // ============================================================

  async function submitVote() {
    if (!selectedCandidate) {
      setMessage("Please select a party.");
      return;
    }

    if (!voter) {
      setMessage("Voter verification is required.");
      return;
    }

    try {
      const response = await fetch(
        `${API}/elections/vote`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            election_id: selectedElection._id,
            voter_id: voter.voter_id,
            candidate_id: selectedCandidate._id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.detail || "Vote could not be submitted."
        );
        return;
      }

      setReceiptId(data.receipt_id || "");

      await loadResults();

      setScreen("success");
    } catch (error) {
      console.error(error);

      setMessage(
        "Server error while submitting vote."
      );
    }
  }

  // ============================================================
  // RESULTS
  // ============================================================

  async function loadResults() {
    if (!selectedElection) {
      return;
    }

    try {
      const response = await fetch(
        `${API}/elections/${selectedElection._id}/results`
      );

      const data = await response.json();

      setResults(data);
    } catch (error) {
      console.error(error);
    }
  }

  async function showResults() {
    await loadResults();

    setScreen("results");
  }

  // ============================================================
  // RESET
  // ============================================================

  function resetVoting() {
    stopCamera();

    setVoterId("");
    setVoter(null);
    setSelectedCandidate(null);
    setMessage("");
    setCameraError("");
    setReceiptId("");

    setScreen("home");
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="app">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <header className="header">

        <div>
          <h1>VoteInsight</h1>

          <p>
            Election Intelligence & Digital Voting
          </p>
        </div>

        <div className="api-status">
          <span className="status-dot"></span>
          SYSTEM ONLINE
        </div>

      </header>


      {/* ======================================================
          HOME / LANDING
      ====================================================== */}

      {screen === "home" && (

        <main className="home">

          <section className="hero">

            <div className="hero-content">

              <span className="badge">
                SYNTHETIC DEMO ELECTION
              </span>

              <h2>
                Digital
                <br />
                <span>Voting Portal</span>
              </h2>

              <p>
                Welcome to the VoteInsight demonstration
                election platform. Verify your identity,
                cast your vote securely and explore
                election intelligence analytics.
              </p>

              <button
                className="primary-btn"
                onClick={startVoting}
              >
                START VOTING →
              </button>

            </div>


            <div className="hero-card">

              <div className="barcode-box">

                <div className="barcode">
                  || ||| | |||| || | ||| ||
                </div>

                <span>
                  VOTEINSIGHT
                </span>

              </div>

              <div className="hero-card-title">
                DIGITAL ELECTION
              </div>

              <div className="hero-card-text">
                Secure • Transparent • Analytical
              </div>

            </div>

          </section>


          <section className="election-card">

            <div className="section-title">

              <span>
                CURRENT ELECTION
              </span>

              <span className="open-badge">
                {selectedElection?.status || "OFFLINE"}
              </span>

            </div>

            <h3>
              {selectedElection?.title ||
                "National Student Leadership Election 2026"}
            </h3>

            <p>
              {selectedElection?.description ||
                "Synthetic demonstration environment."}
            </p>

          </section>


          <div className="home-actions">

            <button
              className="secondary-btn"
              onClick={showResults}
            >
              VIEW ELECTION ANALYTICS
            </button>

          </div>

        </main>
      )}


      {/* ======================================================
          VOTER ID
      ====================================================== */}

      {screen === "voter" && (

        <main className="booth-container">

          <div className="booth-header">

            <span>
              STEP 1 OF 5
            </span>

            <h2>
              Voter Identification
            </h2>

            <p>
              Enter your registered synthetic demo voter ID.
            </p>

          </div>


          <div className="voter-card">

            <div className="identity-icon">
              🪪
            </div>

            <h3>
              Voter ID Verification
            </h3>

            <p className="card-description">
              Your voter ID will be checked against
              the election registration database.
            </p>


            <label>
              VOTER ID
            </label>

            <input
              type="text"
              placeholder="Example: VOTER-0491"
              value={voterId}
              onChange={(event) =>
                setVoterId(
                  event.target.value.toUpperCase()
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  verifyVoter();
                }
              }}
            />


            {message && (

              <div className="error-message">
                {message}
              </div>

            )}


            <button
              className="primary-btn full"
              onClick={verifyVoter}
            >
              VERIFY VOTER →
            </button>


            <button
              className="back-btn"
              onClick={resetVoting}
            >
              ← BACK TO HOME
            </button>

          </div>

        </main>
      )}


      {/* ======================================================
          IDENTITY CONFIRMATION
      ====================================================== */}

      {screen === "identity" && (

        <main className="booth-container">

          <div className="booth-header">

            <span>
              STEP 2 OF 5
            </span>

            <h2>
              Identity Confirmation
            </h2>

            <p>
              Please verify that the displayed information
              belongs to you.
            </p>

          </div>


          <div className="identity-card">

            <div className="verified-badge">
              ✓ VOTER FOUND
            </div>


            <div className="voter-profile">

              <div className="profile-avatar">
                {voter?.name
                  ?.charAt(0)
                  ?.toUpperCase() || "V"}
              </div>

              <div>

                <span>
                  VOTER NAME
                </span>

                <h2>
                  {voter?.name}
                </h2>

                <small>
                  Voter ID: {voter?.voter_id}
                </small>

              </div>

            </div>


            <div className="identity-question">

              <h3>
                Is this your name?
              </h3>

              <p>
                Confirm your identity to continue
                to camera verification.
              </p>

            </div>


            <div className="identity-actions">

              <button
                className="primary-btn"
                onClick={confirmIdentity}
              >
                YES, THIS IS ME →
              </button>

              <button
                className="secondary-btn"
                onClick={rejectIdentity}
              >
                NO, GO BACK
              </button>

            </div>

          </div>

        </main>
      )}


      {/* ======================================================
          CAMERA
      ====================================================== */}

      {screen === "camera" && (

        <main className="booth-container">

          <div className="booth-header">

            <span>
              STEP 3 OF 5
            </span>

            <h2>
              Camera Verification
            </h2>

            <p>
              Activate your camera before entering
              the voting booth.
            </p>

          </div>


          <div className="camera-page">

            <div className="camera-panel">

              <div className="camera-header">

                <span>
                  CAMERA VERIFICATION
                </span>

                {cameraStarted && (
                  <span className="camera-live-label">
                    ● LIVE
                  </span>
                )}

              </div>


              <div className="camera-screen">

                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="camera-video"
                />


                {!cameraStarted && (

                  <div className="camera-overlay">

                    <div className="camera-big-icon">
                      📷
                    </div>

                    <h3>
                      Camera Access Required
                    </h3>

                    <p>
                      Your browser will ask for permission
                      to access your webcam.
                    </p>

                    <button
                      className="primary-btn"
                      onClick={startCamera}
                    >
                      OPEN CAMERA
                    </button>

                  </div>

                )}


                {cameraStarted && (

                  <div className="camera-live-status">

                    <span className="camera-live-dot"></span>

                    CAMERA ACTIVE

                  </div>

                )}

              </div>


              {cameraError && (

                <div className="camera-error">
                  {cameraError}
                </div>

              )}

            </div>


            <div className="verification-side">

              <div className="verification-card">

                <span>
                  VERIFIED VOTER
                </span>

                <h3>
                  {voter?.name}
                </h3>

                <p>
                  {voter?.voter_id}
                </p>

              </div>


              <div className="security-card">

                <div>
                  ✓ Identity confirmed
                </div>

                <div>
                  ✓ Voter registered
                </div>

                <div>
                  ✓ Camera required
                </div>

              </div>


              <button
                className="primary-btn full"
                onClick={continueFromCamera}
              >
                ENTER VOTING BOOTH →
              </button>

            </div>

          </div>

        </main>
      )}


      {/* ======================================================
          VOTING BOOTH
      ====================================================== */}

      {screen === "booth" && (
        <main className="booth-container">

          <div className="booth-header booth-header-center">
            <span>STEP 4 OF 5</span>
            <h2>Secure Voting Booth</h2>
            <p>Camera verification completed. Select one party to continue.</p>
          </div>

          <div className="booth-security-bar">
            <div className="security-status-item">
              <span className="security-check">✓</span>
              <div>
                <strong>IDENTITY VERIFIED</strong>
                <small>{voter?.name}</small>
              </div>
            </div>

            <div className="security-status-item">
              <span className="security-check">✓</span>
              <div>
                <strong>VOTER ID</strong>
                <small>{voter?.voter_id}</small>
              </div>
            </div>

            <div className="security-status-item">
              <span className="security-check">✓</span>
              <div>
                <strong>SECURE SESSION</strong>
                <small>ACTIVE</small>
              </div>
            </div>
          </div>

          <div className="voting-booth-card">

            <div className="ballot-header">
              <div>
                <span>ELECTION BALLOT</span>
                <h3>Select Your Party</h3>
              </div>

              <div className="ballot-count">
                4 OPTIONS
              </div>
            </div>

            <div className="voter-mini-card">
              <div className="profile-avatar small">
                {voter?.name?.charAt(0)?.toUpperCase() || "V"}
              </div>

              <div>
                <span>VERIFIED VOTER</span>
                <strong>{voter?.name}</strong>
                <small>{voter?.voter_id}</small>
              </div>
            </div>

            <div className="voting-instruction">
              <span>YOUR VOTE MATTERS</span>
              <h3>Choose one party</h3>
              <p>
                Select one option below. You can click a party or use
                keyboard keys <strong>1–4</strong>.
              </p>
            </div>

            <div className="party-grid">

              {candidates.slice(0, 4).map((candidate, index) => (
                <button
                  key={candidate._id}
                  className={`party-option ${
                    selectedCandidate?._id === candidate._id ? "selected" : ""
                  }`}
                  onClick={() => selectCandidate(candidate)}
                >
                  <div className="party-number">
                    {index + 1}
                  </div>

                  <div className="party-symbol">
                    {candidate.symbol}
                  </div>

                  <div className="party-details">
                    <strong>{candidate.party}</strong>
                    <span>{candidate.name}</span>
                  </div>

                  <div className="party-key">
                    KEY {index + 1}
                  </div>

                  <div className="party-check">
                    {selectedCandidate?._id === candidate._id ? "✓" : ""}
                  </div>
                </button>
              ))}

            </div>

            {message && (
              <div className="error-message">
                {message}
              </div>
            )}

            <button
              className="primary-btn full ballot-submit"
              onClick={reviewVote}
              disabled={!selectedCandidate}
            >
              REVIEW & CONFIRM VOTE →
            </button>

          </div>

          <div className="booth-demo-notice">
            <span>DEMO ENVIRONMENT</span>
            Synthetic election data only • This is not an official government voting service.
          </div>

        </main>
      )}


      {/* ======================================================
          CONFIRM VOTE
      ====================================================== */}

      {screen === "confirm" && (

        <main className="booth-container">

          <div className="booth-header">

            <span>
              STEP 5 OF 5
            </span>

            <h2>
              Confirm Your Vote
            </h2>

            <p>
              Please carefully review your selection.
            </p>

          </div>


          <div className="confirm-card">

            <div className="confirm-icon">
              ✓
            </div>

            <span>
              YOUR SELECTED PARTY
            </span>

            <h2>
              {selectedCandidate?.party}
            </h2>

            <p>
              {selectedCandidate?.name}
            </p>


            <div className="confirm-voter">

              <span>
                VOTER
              </span>

              <strong>
                {voter?.name}
              </strong>

              <small>
                {voter?.voter_id}
              </small>

            </div>


            <div className="warning-box">
              Once submitted, your vote cannot be
              changed.
            </div>


            {message && (
              <div className="error-message">
                {message}
              </div>
            )}


            <div className="confirm-actions">

              <button
                className="primary-btn"
                onClick={submitVote}
              >
                CONFIRM & CAST VOTE ✓
              </button>

              <button
                className="secondary-btn"
                onClick={() =>
                  setScreen("booth")
                }
              >
                CHANGE SELECTION
              </button>

            </div>

          </div>

        </main>
      )}


      {/* ======================================================
          SUCCESS
      ====================================================== */}

      {screen === "success" && (

        <main className="success-screen">

          <div className="success-icon">
            ✓
          </div>

          <span className="success-label">
            VOTE SUCCESSFULLY RECORDED
          </span>

          <h2>
            Thank You, {voter?.name}
          </h2>

          <p>
            Your vote has been securely recorded
            in the VoteInsight demonstration election.
          </p>


          <div className="receipt-card">

            <span>
              VOTE RECEIPT
            </span>

            <strong>
              {receiptId || "VI-DEMO-RECORDED"}
            </strong>

          </div>


          <div className="success-actions">

            <button
              className="primary-btn"
              onClick={showResults}
            >
              VIEW VOTEINSIGHT ANALYTICS →
            </button>

            <button
              className="secondary-btn"
              onClick={resetVoting}
            >
              RETURN HOME
            </button>

          </div>

        </main>
      )}


      {/* ======================================================
          ANALYTICS
      ====================================================== */}

      {screen === "results" && (

        <main className="results-container">

          <div className="results-header">

            <div>

              <span>
                VOTEINSIGHT
              </span>

              <h2>
                Election Intelligence Dashboard
              </h2>

              <p>
                {selectedElection?.title}
              </p>

            </div>


            <button
              className="back-btn"
              onClick={resetVoting}
            >
              ← HOME
            </button>

          </div>


          {results ? (

            <>

              <section className="stats-grid">

                <div className="stat-card">

                  <span>
                    REGISTERED VOTERS
                  </span>

                  <strong>
                    {results.registered_voters}
                  </strong>

                </div>


                <div className="stat-card">

                  <span>
                    TOTAL VOTES
                  </span>

                  <strong>
                    {results.total_votes}
                  </strong>

                </div>


                <div className="stat-card">

                  <span>
                    TURNOUT
                  </span>

                  <strong>
                    {results.turnout_percentage}%
                  </strong>

                </div>


                <div className="stat-card winner">

                  <span>
                    LEADING PARTY
                  </span>

                  <strong>
                    {results.winner?.party ||
                      results.winner?.name ||
                      "N/A"}
                  </strong>

                </div>

              </section>


              <section className="results-list">

                <div className="analytics-title">

                  <div>

                    <span>
                      LIVE VOTE DISTRIBUTION
                    </span>

                    <h3>
                      Party Performance
                    </h3>

                  </div>

                </div>


                {results.results?.map(
                  (candidate) => (

                    <div
                      className="result-row"
                      key={candidate.candidate_id}
                    >

                      <div className="result-info">

                        <span className="result-symbol">
                          {candidate.symbol}
                        </span>

                        <div>

                          <strong>
                            {candidate.party}
                          </strong>

                          <small>
                            {candidate.name}
                          </small>

                        </div>

                      </div>


                      <div className="result-bar-area">

                        <div className="result-bar">

                          <div
                            className="result-bar-fill"
                            style={{
                              width: `${candidate.percentage}%`,
                            }}
                          ></div>

                        </div>

                        <span>
                          {candidate.votes} votes
                          {" "}
                          ({candidate.percentage}%)
                        </span>

                      </div>

                    </div>

                  )
                )}

              </section>


              <div className="dashboard-note">

                <strong>
                  POWER BI READY
                </strong>

                <p>
                  VoteInsight analytics data can be
                  exported from the Python analytics
                  pipeline and visualized in Power BI.
                </p>

              </div>

            </>

          ) : (

            <div className="loading">
              Loading election analytics...
            </div>

          )}

        </main>
      )}

    </div>
  );
}

export default App;