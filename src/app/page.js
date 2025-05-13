"use client";

import React, { useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/utilities/firebase.config";
import lemmatizer from "lemmatizer";

export default function ReverseDictionaryGame() {
  const [word, setWord] = useState("");
  const [definition, setDefinition] = useState("");
  const [userGuess, setUserGuess] = useState("");
  const [status, setStatus] = useState("");
  const [lengthFilter, setLengthFilter] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [nickname, setNickname] = useState("");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [revealedAnswer, setRevealedAnswer] = useState(false);

  const fetchWordAndDefinition = async () => {
    setStatus("");
    setUserGuess("");
    setRevealedAnswer(false);
    try {
      let api = "https://random-word-api.vercel.app/api?words=1";
      if (lengthFilter) api += `&length=${lengthFilter}`;
      let found = false;
      while (!found) {
        const [raw] = await fetch(api).then(r => r.json());
        const base = lemmatizer(raw);
        if (lengthFilter && base.length !== +lengthFilter) continue;
        const data = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${base}`
        ).then(r => r.json());
        if (Array.isArray(data) && data[0]?.meanings?.[0]?.definitions?.[0]?.definition) {
          setWord(base);
          setDefinition(data[0].meanings[0].definitions[0].definition);
          found = true;
        }
      }
      setStartTime(Date.now());
    } catch (e) {
      setDefinition("Error fetching word or definition.");
    }
  };

  async function fetchHighScore(name) {
    const scoresRef = collection(db, "scores");
    const q = query(
      scoresRef,
      where("nickname", "==", name),
      orderBy("score", "desc"),
      limit(1)
    );
    const snap = await getDocs(q);
    setHighScore(!snap.empty ? snap.docs[0].data().score : 0);
  }

  async function fetchLeaderboard() {
    const snap = await getDocs(collection(db, "scores"));
    const map = {};
    snap.forEach(doc => {
      const { nickname: n, score: s } = doc.data();
      map[n] = Math.max(map[n] || 0, s);
    });
    const list = Object.entries(map)
      .map(([n, s]) => ({ nickname: n, score: s }))
      .sort((a, b) => b.score - a.score);
    setLeaderboard(list);
  }

  const startGame = async () => {
    if (!nickname.trim()) return alert("Please enter a nickname to start.");
    await fetchHighScore(nickname);
    setScore(0);
    setIsPlaying(true);
    await fetchWordAndDefinition();
  };

  const checkGuess = async () => {
    if (revealedAnswer) return;
    const isCorrect = userGuess.trim().toLowerCase() === word;
    const rt = Date.now() - (startTime || Date.now());
    if (isCorrect) {
      setStatus("Correct! 🎉");
      setRevealedAnswer(true);
      const ns = score + 1;
      setScore(ns);
      if (highScore != null && ns > highScore) setHighScore(ns);
      await addDoc(collection(db, "scores"), { nickname, score: ns, timestamp: new Date() });
    } else setStatus("Incorrect. Try again! ❌");

    await addDoc(collection(db, "attempts"), {
      nickname,
      word,
      definition,
      userGuess,
      isCorrect,
      skipped: false,
      reactionTime: rt,
      timestamp: new Date(),
    });
  };

  const handleSkip = async () => {
    const rt = Date.now() - (startTime || Date.now());
    setStatus(`The correct word was: ${word}`);
    setRevealedAnswer(true);
    await addDoc(collection(db, "attempts"), {
      nickname,
      word,
      definition,
      userGuess: "",
      isCorrect: false,
      skipped: true,
      reactionTime: rt,
      timestamp: new Date(),
    });
  };

  const backToMenu = () => {
    setNickname("");
    setLengthFilter("");
    setIsPlaying(false);
    setShowLeaderboard(false);
    setScore(0);
    setHighScore(null);
    setStatus("");
    setUserGuess("");
    setWord("");
    setDefinition("");
    setRevealedAnswer(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white">
      {!isPlaying && !showLeaderboard ? (
        <div className="bg-gray-800 shadow-md rounded-lg w-full max-w-md p-6">
          <h1 className="text-3xl font-bold mb-4 text-center">Reverse Dictionary Game</h1>
          <label className="block mb-2">Nickname:</label>
          <input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            className="mb-4 p-2 w-full border rounded bg-gray-700"
            placeholder="Enter nickname"
          />
          <label className="block mb-2">Word Length (optional):</label>
          <input
            type="number"
            min="1"
            value={lengthFilter}
            onChange={e => setLengthFilter(e.target.value)}
            onKeyDown={e => ["e","E","+","-","."].includes(e.key) && e.preventDefault()}
            className="mb-4 p-2 w-full border rounded bg-gray-700"
            placeholder="e.g. 5"
          />
          <button onClick={startGame} className="w-full bg-green-600 py-2 rounded mb-2">Start Game</button>
          <button onClick={async () => { setShowLeaderboard(true); await fetchLeaderboard(); }} className="w-full border border-yellow-500 py-2 rounded">Leaderboard</button>
        </div>
      ) : showLeaderboard ? (
        <div className="bg-gray-800 shadow-md rounded-lg w-full max-w-md p-6">
          <h2 className="text-2xl font-bold mb-4 text-center">Leaderboard</h2>
          <table className="w-full text-left">
            <thead><tr><th>Player</th><th>High Score</th></tr></thead>
            <tbody>
              {leaderboard.map(e => (
                <tr key={e.nickname}><td>{e.nickname}</td><td>{e.score}</td></tr>
              ))}
            </tbody>
          </table>
          <button onClick={backToMenu} className="w-full mt-4 border py-2 rounded">Back to Menu</button>
        </div>
      ) : (
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold mb-4 text-center">Reverse Dictionary Game</h1>
          <div className="bg-gray-800 shadow-md rounded-lg p-6">
            <p className="mb-4 font-semibold">Definition:</p>
            <p className="mb-6 italic">{definition}</p>
            <input
              value={userGuess}
              onChange={e => setUserGuess(e.target.value)}
              className="mb-4 p-2 w-full border rounded bg-gray-700"
              placeholder="Guess the word..."
            />
            <>  
              {!revealedAnswer ? (
                <> 
                  <button onClick={checkGuess} className="w-full bg-blue-600 py-2 rounded mb-2">Submit</button>
                  <button onClick={handleSkip} className="w-full border border-red-500 py-2 rounded mb-2">I don’t know</button>
                </>
              ) : (
                <button onClick={fetchWordAndDefinition} className="w-full bg-green-600 py-2 rounded mb-2">Next Word</button>
              )}
              {highScore !== null && (
                <p className="text-center text-sm text-yellow-300 mb-2">Previous High Score: {highScore}</p>
              )}
            </>
            {status && <p className="mt-2 text-center">{status}</p>}
            <p className="mt-2 text-sm text-center">Score: {score}</p>
            <button onClick={backToMenu} className="mt-4 w-full border py-2 rounded">Back to Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}