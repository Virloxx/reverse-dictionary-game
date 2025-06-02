"use client";

import React, { useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/utilities/firebase.config";
import lemmatizer from "lemmatizer";

export default function ReverseDictionaryGame() {
  const [nickname, setNickname] = useState("");
  const [mode, setMode] = useState("test");
  const [wordLength, setWordLength] = useState("");
  const [word, setWord] = useState("");
  const [definition, setDefinition] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [userGuess, setUserGuess] = useState("");
  const [feedback, setFeedback] = useState("");
  const [revealedAnswer, setRevealedAnswer] = useState(false);
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [highScore, setHighScore] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [showWordsView, setShowWordsView] = useState(false);
  const [wordStats, setWordStats] = useState([]);
  const [shuffledPool, setShuffledPool] = useState([]);
  const [poolIndex, setPoolIndex] = useState(0);
  const [testCompleted, setTestCompleted] = useState(false);

  const fetchWordPool = async () => {
    const poolDoc = await getDoc(doc(db, "config", "wordPool"));
    return poolDoc.exists() ? poolDoc.data().words : [];
  };

  const fetchWordAndDefinition = async () => {
    setFeedback("");
    setUserGuess("");
    setRevealedAnswer(false);
    try {
      let api = "https://random-word-api.vercel.app/api?words=1";
      if (wordLength) api += `&length=${wordLength}`;
      let found = false;
      while (!found) {
        const [raw] = await fetch(api).then((r) => r.json());
        const base = lemmatizer(raw);
        if (wordLength && base.length !== +wordLength) continue;
        const data = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${base}`
        ).then((r) => r.json());
        if (
          Array.isArray(data) &&
          data[0]?.meanings?.[0]?.definitions?.[0]?.definition
        ) {
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

  const fetchWordAndDefinitionTestMode = async (poolArray, idx) => {
    setFeedback("");
    setUserGuess("");
    setRevealedAnswer(false);
    if (idx >= poolArray.length) {
      setFeedback(`You’ve gone through all ${poolIndex + 1} words.`);
      setTestCompleted(true);
      return;
    }
    try {
      const poolWord = poolArray[idx];
      const data = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${poolWord}`
      ).then((r) => r.json());
      if (
        Array.isArray(data) &&
        data[0]?.meanings?.[0]?.definitions?.[0]?.definition
      ) {
        setWord(poolWord);
        setDefinition(data[0].meanings[0].definitions[0].definition);
      } else {
        setDefinition("Definition not found. Skipping...");
      }
      setStartTime(Date.now());
    } catch (e) {
      setDefinition("Error fetching definition for test word.");
    }
  };

  async function fetchHighScore(name) {
    const scoresRef = collection(db, "scores");
    const q = query(
      scoresRef,
      where("nickname", "==", name),
      where("mode", "==", mode),
      orderBy("score", "desc"),
      limit(1)
    );
    const snap = await getDocs(q);
    setHighScore(!snap.empty ? snap.docs[0].data().score : 0);
  }

  async function fetchLeaderboard() {
    const scoresRef = collection(db, "scores");
    const scoresQ = query(scoresRef, where("mode", "==", mode));
    const attemptsRef = collection(db, "attempts");
    const attemptsQ = query(attemptsRef, where("mode", "==", mode));
    const [scoresSnap, attemptsSnap] = await Promise.all([
      getDocs(scoresQ),
      getDocs(attemptsQ),
    ]);
    const stats = {};
    scoresSnap.forEach((doc) => {
      const { nickname, score } = doc.data();
      if (!stats[nickname]) stats[nickname] = { score: 0, wordData: {}, mistakes: 0 };
      stats[nickname].score = Math.max(stats[nickname].score, score);
    });
    attemptsSnap.forEach((doc) => {
      const { nickname, word, skipped, isCorrect, reactionTime } = doc.data();
      if (!nickname || !word) return;
      if (!stats[nickname]) stats[nickname] = { score: 0, wordData: {}, mistakes: 0 };

      const player = stats[nickname];
      if (!player.wordData[word]) player.wordData[word] = { times: [], mistakes: 0, guessed: false };

      if (skipped) return;

      const time = parseFloat(reactionTime);
      if (isCorrect) {
        player.wordData[word].times.push(time);
        player.wordData[word].guessed = true;
      } else {
        player.wordData[word].mistakes += 1;
        player.mistakes += 1;
      }
    });
    const leaderboard = Object.entries(stats).map(([nickname, data]) => {
      const { score, wordData, mistakes } = data;
      const guessedWords = Object.entries(wordData).filter(([, v]) => v.guessed);
      const allTimes = guessedWords.flatMap(([, v]) => v.times);
      const shortest = allTimes.length ? Math.min(...allTimes).toFixed(2) : "–";
      const longest = allTimes.length ? Math.max(...allTimes).toFixed(2) : "–";
      const average = allTimes.length
        ? (allTimes.reduce((a, b) => a + b, 0) / allTimes.length).toFixed(2)
        : "–";

      const wordDifficulty = guessedWords.map(([word, data2]) => {
        const avgTime = data2.times.length
          ? data2.times.reduce((a, b) => a + b, 0) / data2.times.length
          : Infinity;
        return { word, difficultyScore: avgTime + data2.mistakes * 5 };
      });
      wordDifficulty.sort((a, b) => a.difficultyScore - b.difficultyScore);
      const easiestWord = wordDifficulty[0]?.word ?? "–";
      const hardestWord = wordDifficulty[wordDifficulty.length - 1]?.word ?? "–";
      return {
        nickname,
        score,
        shortest,
        longest,
        average,
        wrongs: mistakes,
        easiestWord,
        hardestWord,
      };
    });
    leaderboard.sort((a, b) => b.score - a.score);
    setLeaderboard(leaderboard);
  }

  async function fetchWordStats() {
    const attemptsRef = collection(db, "attempts");
    const attemptsQ = query(attemptsRef, where("mode", "==", mode));
    const attemptsSnap = await getDocs(attemptsQ);
    const wordMap = {};
    attemptsSnap.forEach((doc) => {
      const { word, nickname, isCorrect, skipped, reactionTime } = doc.data();
      if (!word || !nickname) return;
      if (!wordMap[word]) {
        wordMap[word] = { attempted: new Set(), correct: new Set(), mistakes: 0, times: [] };
      }
      const entry = wordMap[word];
      entry.attempted.add(nickname);
      if (skipped) return;
      if (isCorrect) {
        entry.correct.add(nickname);
        if (reactionTime != null) {
          entry.times.push(parseFloat(reactionTime));
        }
      } else {
        entry.mistakes += 1;
      }
    });
    const stats = Object.entries(wordMap).map(([word, data]) => {
      const totalPlayers = data.attempted.size;
      const correctPlayers = data.correct.size;
      const guessRate = totalPlayers
        ? ((correctPlayers / totalPlayers) * 100).toFixed(1)
        : "0.0";
      const avgTime = data.times.length
        ? (data.times.reduce((a, b) => a + b, 0) / data.times.length).toFixed(2)
        : "–";
      return { word, guessRate, mistakes: data.mistakes, avgTime };
    });
    stats.sort((a, b) => parseFloat(b.guessRate) - parseFloat(a.guessRate));
    setWordStats(stats);
  }

  const startGame = async () => {
    if (!nickname.trim()) return alert("Please enter a nickname to start.");
    await fetchHighScore(nickname);
    setScore(0);
    setIsPlaying(true);
    setTestCompleted(false);

    if (mode === "test") {
      const pool = await fetchWordPool();
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      setShuffledPool(shuffled);
      setPoolIndex(0);
      await fetchWordAndDefinitionTestMode(shuffled, 0);
    } else {
      await fetchWordAndDefinition();
    }
  };

  const checkGuess = async () => {
    if (revealedAnswer || testCompleted) return;
    if (!userGuess.trim()) {
      setFeedback("Please enter your guess.");
      return;
    }
    const isCorrect = userGuess.trim().toLowerCase() === word;
    const rt = Date.now() - (startTime || Date.now());
    const reactionTimeSec = +(rt / 1000).toFixed(2);
    if (isCorrect) {
      setFeedback("Correct! 🎉");
      setRevealedAnswer(true);
      const ns = score + 1;
      setScore(ns);
      if (highScore != null && ns > highScore) setHighScore(ns);
      await addDoc(collection(db, "scores"), {
        nickname,
        score: ns,
        mode: mode,
        timestamp: new Date(),
      });
    } else {
      setFeedback("Incorrect. Try again! ❌");
    }
    await addDoc(collection(db, "attempts"), {
      nickname,
      word,
      definition,
      userGuess,
      isCorrect,
      skipped: false,
      reactionTime: reactionTimeSec,
      mode: mode,
      timestamp: new Date(),
    });
  };

  const handleSkip = async () => {
    if (testCompleted) return;
    const rt = Date.now() - (startTime || Date.now());
    const reactionTimeSec = +(rt / 1000).toFixed(2);
    setFeedback(`The correct word was: ${word}`);
    setRevealedAnswer(true);
    await addDoc(collection(db, "attempts"), {
      nickname,
      word,
      definition,
      userGuess: "",
      isCorrect: false,
      skipped: true,
      reactionTime: reactionTimeSec,
      mode: mode,
      timestamp: new Date(),
    });
  };

  const backToMenu = () => {
    setNickname("");
    setWordLength("");
    setIsPlaying(false);
    setShowLeaderboard(false);
    setShowWordsView(false);
    setScore(0);
    setHighScore(null);
    setFeedback("");
    setUserGuess("");
    setWord("");
    setDefinition("");
    setRevealedAnswer(false);
    setTestCompleted(false);
    setShuffledPool([]);
    setPoolIndex(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-6">
      {!isPlaying && !showLeaderboard ? (
        <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-8">
          <h1 className="text-4xl font-bold mb-6 text-center text-white">Reverse Dictionary</h1>
          <label className="block mb-2 text-gray-200">Nickname:</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="mb-4 p-3 w-full rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Enter nickname"
          />
          <label className="block mb-2 text-gray-200">Game Mode:</label>
          <div className="flex space-x-3 mb-6">
            <button
              onClick={() => setMode("test")}
              className={`flex-1 py-3 rounded-lg text-white font-semibold transition ${
                mode === "test" ? "bg-green-600 hover:bg-green-700" : "bg-gray-700 hover:bg-gray-600"
              } focus:outline-none focus:ring-2 focus:ring-green-400`}
            >
              Test Mode
            </button>
            <button
              onClick={() => setMode("random")}
              className={`flex-1 py-3 rounded-lg text-white font-semibold transition ${
                mode === "random" ? "bg-green-600 hover:bg-green-700" : "bg-gray-700 hover:bg-gray-600"
              } focus:outline-none focus:ring-2 focus:ring-green-400`}
            >
              Random Mode
            </button>
          </div>
          <label className="block mb-2 text-gray-200">Word Length (optional):</label>
          <input
            type="number"
            min="3"
            max="9"
            value={wordLength}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (val > 9 || val < 3) return;
              setWordLength(e.target.value);
            }}
            onKeyDown={(e) => ["e", "E", "+", "-", ".", ","].includes(e.key) && e.preventDefault()}
            className={`mb-6 p-3 w-full rounded-lg text-white placeholder-gray-400 focus:outline-none ${
              mode === "test" ? "bg-gray-600 cursor-not-allowed" : "bg-gray-700 focus:ring-2 focus:ring-green-500"
            }`}
            placeholder={mode === "test" ? "(disabled in Test Mode)" : "Max: 9"}
            disabled={mode === "test"}
          />
          <button
            onClick={startGame}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition mb-4 focus:outline-none focus:ring-2 focus:ring-green-400"
          >
            Start Game
          </button>
          <button
            onClick={async () => {
              setShowLeaderboard(true);
              await fetchLeaderboard();
            }}
            className="w-full border border-yellow-500 hover:border-yellow-400 text-yellow-500 hover:text-yellow-400 py-3 rounded-lg font-semibold transition focus:outline-none focus:ring-2 focus:ring-yellow-400"
          >
            Leaderboard
          </button>
        </div>
      ) : showLeaderboard ? (
        <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl p-8">
          <h2 className="text-3xl font-bold mb-6 text-center text-white">
            {showWordsView ? "Word Statistics" : "Leaderboard"}
          </h2>
          <div className="overflow-x-auto mb-6">
            {!showWordsView ? (
              leaderboard.length === 0 ? (
                <p className="text-center text-gray-400 py-8">
                  No player data available. Start playing to be featured here!
                </p>
              ) : (
                <table className="min-w-full text-gray-200 text-sm">
                  <thead>
                    <tr className="bg-gray-700">
                      <th className="px-4 py-3 text-center">Player</th>
                      <th className="px-4 py-3 text-center">High Score</th>
                      <th className="px-4 py-3 text-center">Shortest [s]</th>
                      <th className="px-4 py-3 text-center">Longest [s]</th>
                      <th className="px-4 py-3 text-center">Average [s]</th>
                      <th className="px-4 py-3 text-center">Mistakes</th>
                      <th className="px-4 py-3 text-center">Easiest Word</th>
                      <th className="px-4 py-3 text-center">Hardest Word</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((e, i) => (
                      <tr
                        key={i}
                        className={`border-t ${
                          i % 2 === 0 ? "bg-gray-800" : "bg-gray-700"
                        }`}
                      >
                        <td className="px-4 py-3 text-center">{e.nickname}</td>
                        <td className="px-4 py-3 text-center">{e.score}</td>
                        <td className="px-4 py-3 text-center">{e.shortest}</td>
                        <td className="px-4 py-3 text-center">{e.longest}</td>
                        <td className="px-4 py-3 text-center">{e.average}</td>
                        <td className="px-4 py-3 text-center">{e.wrongs}</td>
                        <td className="px-4 py-3 text-center">{e.easiestWord}</td>
                        <td className="px-4 py-3 text-center">{e.hardestWord}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : wordStats.length === 0 ? (
              <p className="text-center text-gray-400 py-8">
                No word data available. Try playing a few rounds first!
              </p>
            ) : (
              <table className="min-w-full text-gray-200 text-sm">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="px-4 py-3 text-center">Word</th>
                    <th className="px-4 py-3 text-center">Guessed (%)</th>
                    <th className="px-4 py-3 text-center">Mistakes</th>
                    <th className="px-4 py-3 text-center">Average Time [s]</th>
                  </tr>
                </thead>
                <tbody>
                  {wordStats.map((e, i) => (
                    <tr
                      key={i}
                      className={`border-t ${
                        i % 2 === 0 ? "bg-gray-800" : "bg-gray-700"
                      }`}
                    >
                      <td className="px-4 py-3 text-center">{e.word}</td>
                      <td className="px-4 py-3 text-center">{e.guessRate}%</td>
                      <td className="px-4 py-3 text-center">{e.mistakes}</td>
                      <td className="px-4 py-3 text-center">{e.avgTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => {
                if (!showWordsView) fetchWordStats();
                setShowWordsView(!showWordsView);
              }}
              className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-6 rounded-lg font-semibold transition focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              {showWordsView ? "Leaderboard" : "Words"}
            </button>
            <button
              onClick={backToMenu}
              className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-6 rounded-lg font-semibold transition focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Back to Menu
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-md">
          <h1 className="text-4xl font-bold mb-6 text-center text-white">Reverse Dictionary</h1>
          <div className="bg-gray-800 rounded-2xl shadow-xl p-8">
            {mode === "test" && !testCompleted && (
              <p className="text-sm text-gray-400 mb-4 text-left">
                Round {poolIndex + 1} of {shuffledPool.length}
              </p>
            )}

            {! (mode === "test" && testCompleted) && (
              <>
                <p className="mb-4 text-lg font-semibold text-gray-200 text-left">Definition:</p>
                <p className="mb-6 italic text-gray-300 text-left">{definition}</p>
                <input
                  value={userGuess}
                  onChange={(e) => setUserGuess(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") checkGuess();
                  }}
                  disabled={testCompleted}
                  className="mb-4 p-3 w-full rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Guess the word..."
                />
              </>
            )}

            <>
              {!revealedAnswer && !testCompleted ? (
                <>
                  <button
                    onClick={checkGuess}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Submit
                  </button>
                  <button
                    onClick={handleSkip}
                    className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    I don’t know
                  </button>
                </>
              ) : revealedAnswer && !testCompleted ? (
                <button
                  onClick={async () => {
                    if (mode === "test") {
                      const nextIdx = poolIndex + 1;
                      setPoolIndex(nextIdx);
                      await fetchWordAndDefinitionTestMode(shuffledPool, nextIdx);
                    } else {
                      await fetchWordAndDefinition();
                    }
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition"
                >
                  Next Word
                </button>
              ) : (
                <div className="bg-gray-700 rounded-lg p-6 mt-4">
                  <p className="text-2xl font-bold text-center text-green-400 mb-2">
                    🎉 Test Complete! 🎉
                  </p>
                  <p className="text-lg text-center text-gray-200">
                    Your final score:
                  </p>
                  <p className="text-3xl font-bold text-green-400 text-center mb-4">
                    {score}
                  </p>
                  <button
                    onClick={backToMenu}
                    className="mx-auto block bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded-lg font-semibold transition"
                  >
                    Back to Menu
                  </button>
                </div>
              )}
              {mode !== "test" && highScore !== null && (
                <p className="mt-4 text-center text-sm text-yellow-300">
                  Previous High Score: {highScore}
                </p>
              )}
            </>
            {feedback && <p className="mt-4 text-center text-gray-300">{feedback}</p>}
            {!(mode === "test" && testCompleted) && (
              <p className="mt-4 text-lg text-center text-gray-200">Score: {score}</p>
            )}
            {mode !== "test" && (
              <button
                onClick={backToMenu}
                className="mt-6 w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg font-semibold transition focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Back to Menu
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
