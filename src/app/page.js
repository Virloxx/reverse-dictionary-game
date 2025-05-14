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
    const [attemptsSnap, scoresSnap] = await Promise.all([
      getDocs(collection(db, "attempts")),
      getDocs(collection(db, "scores"))
    ]);

    const stats = {};
    scoresSnap.forEach(doc => {
      const { nickname, score } = doc.data();
      if (!stats[nickname]) stats[nickname] = { score: 0, wordTimes: {}, wrongs: 0 };
      stats[nickname].score = Math.max(stats[nickname].score, score);
    });

    attemptsSnap.forEach(doc => {
      const { nickname, reactionTime, skipped, isCorrect, word } = doc.data();
      if (!stats[nickname]) stats[nickname] = { score: 0, wordTimes: {}, wrongs: 0 };

      if (reactionTime != null && skipped !== true) {
        const n = nickname;
        stats[n].wordTimes[word] = stats[n].wordTimes[word] || [];
        stats[n].wordTimes[word].push(parseFloat(reactionTime));

        if (!isCorrect) {
          stats[n].wrongs += 1;
        }
      }
    });

    const list = Object.entries(stats).map(([nickname, data]) => {
      const { score, wordTimes, wrongs } = data;

      const avgByWord = Object.entries(wordTimes).map(
        ([w, arr]) => ({ word: w, avg: arr.reduce((a, b) => a + b, 0) / arr.length })
      );
      avgByWord.sort((a, b) => a.avg - b.avg);

      const easiestWord = avgByWord.length >= 2 ? avgByWord[0].word      : "–";
      const hardestWord = avgByWord.length >= 2 ? avgByWord[avgByWord.length - 1].word : "–";
      const allTimes = avgByWord.flatMap(wt => wordTimes[wt.word]);
      const shortest  = allTimes.length ? Math.min(...allTimes).toFixed(2) : "–";
      const longest   = allTimes.length ? Math.max(...allTimes).toFixed(2) : "–";
      const average   = allTimes.length
        ? (allTimes.reduce((a, b) => a + b, 0) / allTimes.length).toFixed(2)
        : "–";

      return { nickname, score, shortest, longest, average, wrongs, easiestWord, hardestWord };
    });

    list.sort((a, b) => b.score - a.score);
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
    const reactionTimeSec = +(rt / 1000).toFixed(2);

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
      reactionTime: reactionTimeSec,
      timestamp: new Date(),
    });
  };

  const handleSkip = async () => {
    const rt = Date.now() - (startTime || Date.now());
    const reactionTimeSec = +(rt / 1000).toFixed(2);

    setStatus(`The correct word was: ${word}`);
    setRevealedAnswer(true);
    await addDoc(collection(db, "attempts"), {
      nickname,
      word,
      definition,
      userGuess: "",
      isCorrect: false,
      skipped: true,
      reactionTime: reactionTimeSec,
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
            onKeyDown={e => ["e","E","+","-",".",","].includes(e.key) && e.preventDefault()}
            className="mb-4 p-2 w-full border rounded bg-gray-700"
            placeholder="e.g. 5"
          />
          <button onClick={startGame} className="w-full bg-green-600 py-2 rounded mb-2 cursor-pointer">Start Game</button>
          <button onClick={async () => { setShowLeaderboard(true); await fetchLeaderboard(); }} className="w-full border border-yellow-500 py-2 rounded cursor-pointer">Leaderboard</button>
        </div>
      ) : showLeaderboard ? (
        <div className="bg-gray-800 shadow-md rounded-lg w-full max-w-7xl p-6 overflow-x-auto">
          <h2 className="text-2xl font-bold mb-4 text-center">Leaderboard</h2>
          <table className="w-full text-sm border border-gray-700">
            <thead>
              <tr className="bg-gray-700 text-yellow-300">
                <th className="border px-2 py-1">Player</th>
                <th className="border px-2 py-1">High Score</th>
                <th className="border px-2 py-1">Shortest Time (s)</th>
                <th className="border px-2 py-1">Longest Time (s)</th>
                <th className="border px-2 py-1">Avg Time (s)</th>
                <th className="border px-2 py-1">Mistakes</th>
                <th className="border px-2 py-1">Easiest Word</th>
                <th className="border px-2 py-1">Hardest Word</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((e, i) => (
                <tr key={i} className="text-center border-t border-gray-700">
                  <td className="border px-2 py-1">{e.nickname}</td>
                  <td className="border px-2 py-1">{e.score}</td>
                  <td className="border px-2 py-1">{e.shortest}</td>
                  <td className="border px-2 py-1">{e.longest}</td>
                  <td className="border px-2 py-1">{e.average}</td>
                  <td className="border px-2 py-1">{e.wrongs}</td>
                  <td className="border px-2 py-1">{e.easiestWord}</td>
                  <td className="border px-2 py-1">{e.hardestWord}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={backToMenu} className="w-full mt-4 border py-2 rounded cursor-pointer">Back to Menu</button>
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
                  <button onClick={checkGuess} className="w-full bg-blue-600 py-2 rounded mb-2 cursor-pointer">Submit</button>
                  <button onClick={handleSkip} className="w-full border border-red-500 py-2 rounded mb-2 cursor-pointer">I don’t know</button>
                </>
              ) : (
                <button onClick={fetchWordAndDefinition} className="w-full bg-green-600 py-2 rounded mb-2 cursor-pointer">Next Word</button>
              )}
              {highScore !== null && (
                <p className="text-center text-sm text-yellow-300 mb-2">Previous High Score: {highScore}</p>
              )}
            </>
            {status && <p className="mt-2 text-center">{status}</p>}
            <p className="mt-2 text-sm text-center">Score: {score}</p>
            <button onClick={backToMenu} className="mt-4 w-full border py-2 rounded cursor-pointer">Back to Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}
