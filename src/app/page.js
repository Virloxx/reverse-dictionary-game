"use client"

import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/utilities/firebase.config';

export default function ReverseDictionaryGame() {
  const [word, setWord] = useState('');
  const [definition, setDefinition] = useState('');
  const [userGuess, setUserGuess] = useState('');
  const [status, setStatus] = useState('');
  const [lengthFilter, setLengthFilter] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [nickname, setNickname] = useState('');
  const [score, setScore] = useState(0);
  const [showScores, setShowScores] = useState(false);
  const [scoreSearchName, setScoreSearchName] = useState('');
  const [foundScore, setFoundScore] = useState(null);

  const fetchWordAndDefinition = async () => {
    setStatus('');
    setUserGuess('');
    try {
      let wordApi = 'https://random-word-api.vercel.app/api?words=1';
      if (lengthFilter) {
        wordApi += `&length=${lengthFilter}`;
      }
      const wordRes = await fetch(wordApi);
      const [randomWord] = await wordRes.json();
      setWord(randomWord);

      const defRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${randomWord}`);
      const defData = await defRes.json();

      if (Array.isArray(defData) && defData[0]?.meanings?.[0]?.definitions?.[0]?.definition) {
        setDefinition(defData[0].meanings[0].definitions[0].definition);
      } else {
        setDefinition('Definition not found. Try again!');
      }
    } catch (err) {
      setDefinition('Error fetching word or definition.');
    }
  };

  const checkGuess = async () => {
    if (userGuess.trim().toLowerCase() === word.toLowerCase()) {
      setStatus('Correct! 🎉');
      const newScore = score + 1;
      setScore(newScore);
      if (nickname) {
        await addDoc(collection(db, "scores"), {
          nickname: nickname,
          score: newScore,
          timestamp: new Date(),
        });
      }
    } else {
      setStatus('Incorrect. Try again! ❌');
    }
  };

  const startGame = () => {
    if (!nickname.trim()) {
      alert("Please enter a nickname to start the game.");
      return;
    }
    setIsPlaying(true);
    fetchWordAndDefinition();
  };

  const fetchScoreByNickname = async (name) => {
    if (!name) return;
    const scoresRef = collection(db, 'scores');
    const q = query(scoresRef, where('nickname', '==', name), orderBy('timestamp', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      setFoundScore(snapshot.docs[0].data().score);
    } else {
      setFoundScore('No score found.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-900 text-white">
      {!isPlaying && !showScores ? (
        <div className="bg-gray-800 shadow-md rounded-lg w-full max-w-md p-6">
          <h1 className="text-3xl font-bold mb-4 text-center">Reverse Dictionary Game</h1>
          <label className="block mb-2">Nickname:</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="mb-4 p-2 w-full border border-gray-700 rounded bg-gray-700 text-white placeholder-gray-400"
            placeholder="Enter your nickname"
          />
          <label className="block mb-2">Word Length (optional):</label>
          <input
            type="number"
            min="1"
            value={lengthFilter}
            onChange={(e) => setLengthFilter(e.target.value)}
            className="mb-4 p-2 w-full border border-gray-700 rounded bg-gray-700 text-white placeholder-gray-400"
            placeholder="e.g. 5"
          />
          <button
            onClick={startGame}
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 mb-4"
          >
            Start Game
          </button>
          <button
            onClick={() => {
              setShowScores(true);
              setScoreSearchName(nickname);
              fetchScoreByNickname(nickname);
            }}
            className="w-full border border-yellow-500 text-yellow-400 py-2 rounded hover:bg-gray-700"
          >
            Check Score
          </button>
        </div>
      ) : showScores ? (
        <div className="bg-gray-800 shadow-md rounded-lg w-full max-w-md p-6">
          <h2 className="text-2xl font-bold mb-4 text-center">Check Scores</h2>
          <input
            type="text"
            value={scoreSearchName}
            onChange={(e) => setScoreSearchName(e.target.value)}
            className="mb-4 p-2 w-full border border-gray-700 rounded bg-gray-700 text-white placeholder-gray-400"
            placeholder="Enter nickname to search"
          />
          <button
            onClick={() => fetchScoreByNickname(scoreSearchName)}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 mb-4"
          >
            Search
          </button>
          {foundScore !== null && (
            <p className="text-center text-lg">{typeof foundScore === 'number' ? `${scoreSearchName}'s Score: ${foundScore}` : foundScore}</p>
          )}
          <button
            onClick={() => setShowScores(false)}
            className="w-full mt-6 border border-gray-500 text-gray-300 py-2 rounded hover:bg-gray-700"
          >
            Back to Menu
          </button>
        </div>
      ) : (
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold mb-4 text-center">Reverse Dictionary Game</h1>
          <div className="bg-gray-800 shadow-md rounded-lg p-6">
            <p className="mb-4 text-lg font-semibold">Definition:</p>
            <p className="mb-6 italic">{definition}</p>

            <input
              type="text"
              placeholder="Guess the word..."
              value={userGuess}
              onChange={(e) => setUserGuess(e.target.value)}
              className="mb-4 p-2 w-full border border-gray-700 rounded bg-gray-700 text-white placeholder-gray-400"
            />
            <button
              onClick={checkGuess}
              className="mb-2 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Submit
            </button>
            <button
              onClick={fetchWordAndDefinition}
              className="w-full border border-blue-500 text-blue-400 py-2 rounded hover:bg-gray-700"
            >
              Next Word
            </button>

            {status && (
              <p className="mt-4 text-center text-lg font-semibold">{status}</p>
            )}
            <p className="mt-2 text-sm text-center">Score: {score}</p>
          </div>
        </div>
      )}
    </div>
  );
}
